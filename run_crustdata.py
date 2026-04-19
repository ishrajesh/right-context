"""
Pick 2 companies × 2 people per segment from outreach_list.csv,
then call Crustdata APIs:
  - /screener/person/enrich (enrich_realtime=true) for each person
  - /screener/web-search for an intent-signal query per company

Usage:
  python run_crustdata.py --dry-run      # just show the picks
  python run_crustdata.py                # run the APIs, write results.json
  python run_crustdata.py --only enrich  # or --only search
"""

import argparse
import csv
import json
import socket
import sys
import time
from collections import defaultdict
from pathlib import Path

import requests

# Force IPv4 — api.crustdata.com's AAAA path hangs on this network.
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_only(host, *a, **kw):
    return [x for x in _orig_getaddrinfo(host, *a, **kw) if x[0] == socket.AF_INET]
socket.getaddrinfo = _ipv4_only

ROOT = Path(__file__).parent
CSV_PATH = ROOT / "outreach_list.csv"
ENV_PATH = ROOT / ".env"
OUT_PATH = ROOT / "results.json"
BASE = "https://api.crustdata.com"


def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def pick_samples(rows, companies_per_segment=2, people_per_company=2):
    by_seg: dict = defaultdict(lambda: defaultdict(list))
    for r in rows:
        by_seg[r["Segment"]][r["Company"]].append(r)

    def prio(row):
        try:
            return int(row.get("Outreach Priority") or 99)
        except ValueError:
            return 99

    picks = []
    for seg, comps in by_seg.items():
        ranked = sorted(comps.items(), key=lambda kv: min(prio(x) for x in kv[1]))
        for comp, people in ranked[:companies_per_segment]:
            top_people = sorted(people, key=prio)[:people_per_company]
            picks.append({"segment": seg, "company": comp, "people": top_people})
    return picks


def normalize_linkedin(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not url.startswith("http"):
        url = "https://" + url
    return url


def _result(r):
    try:
        return {"status": r.status_code, "data": r.json()}
    except Exception:
        return {"status": r.status_code, "data": r.text[:1000]}


def enrich_person(linkedin_url: str, headers: dict):
    url = f"{BASE}/screener/person/enrich"
    params = {"linkedin_profile_url": linkedin_url, "enrich_realtime": "true"}
    r = requests.get(url, params=params, headers=headers, timeout=180)
    return _result(r)


def web_search(query: str, headers: dict):
    url = f"{BASE}/screener/web-search"
    r = requests.post(url, json={"query": query}, headers=headers, timeout=120)
    return _result(r)


def intent_query(company: str) -> str:
    return f'"{company}" (alternative OR "switching from" OR "migrating" OR "replace" OR "vs")'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Show picks without calling APIs")
    ap.add_argument("--only", choices=["enrich", "search"], help="Run only one API type")
    ap.add_argument("--companies", type=int, default=2, help="Companies per segment")
    ap.add_argument("--people", type=int, default=2, help="People per company")
    ap.add_argument("--limit", type=int, default=None, help="Only process first N company groups (after segment filter)")
    ap.add_argument("--segments", type=str, default=None, help="Comma-separated segment names to include")
    ap.add_argument("--force", action="store_true", help="Re-run companies already in results.json")
    args = ap.parse_args()

    if not CSV_PATH.exists():
        sys.exit(f"Missing {CSV_PATH}")

    with CSV_PATH.open() as f:
        rows = list(csv.DictReader(f))

    picks = pick_samples(rows, args.companies, args.people)

    if args.segments:
        wanted = {s.strip().lower() for s in args.segments.split(",")}
        picks = [g for g in picks if g["segment"].lower() in wanted]
    if args.limit is not None:
        picks = picks[: args.limit]

    print(f"Picked {len(picks)} company groups across {len({p['segment'] for p in picks})} segments:\n")
    for g in picks:
        print(f"  [{g['segment']}] {g['company']}")
        for p in g["people"]:
            li = p.get("LinkedIn") or "(no LinkedIn)"
            print(f"      - {p['Name']} — {p['Title']}  |  {li}")
    print()

    if args.dry_run:
        return

    env = load_env(ENV_PATH)
    key = env.get("CRUSTDATA_API_KEY")
    if not key:
        sys.exit("CRUSTDATA_API_KEY not set in .env")

    headers = {"Authorization": f"Token {key}", "Content-Type": "application/json"}

    # Load existing results so we can resume/skip.
    existing = []
    if OUT_PATH.exists():
        try:
            existing = json.loads(OUT_PATH.read_text())
        except Exception:
            existing = []
    done_keys = {(e["segment"], e["company"]) for e in existing}

    results = list(existing)
    for g in picks:
        key_tuple = (g["segment"], g["company"])
        if key_tuple in done_keys and not args.force:
            print(f"[skip]   {g['company']} — already in {OUT_PATH.name} (use --force to redo)")
            continue

        entry = {"segment": g["segment"], "company": g["company"], "intent_signal": None, "people": []}

        if args.only != "enrich":
            q = intent_query(g["company"])
            print(f"[search] {g['company']!r}  q={q}")
            entry["intent_signal"] = {"query": q, "response": web_search(q, headers)}
            time.sleep(1)

        if args.only != "search":
            for p in g["people"]:
                li = normalize_linkedin(p.get("LinkedIn", ""))
                if not li:
                    print(f"[skip]   {p['Name']}: no LinkedIn")
                    entry["people"].append({"person": p, "skipped": "no_linkedin"})
                    continue
                print(f"[enrich] {p['Name']} <{li}>")
                entry["people"].append({"person": p, "enrichment": enrich_person(li, headers)})
                time.sleep(1)

        # Replace if forcing, else append.
        results = [r for r in results if (r["segment"], r["company"]) != key_tuple]
        results.append(entry)
        OUT_PATH.write_text(json.dumps(results, indent=2, default=str))
        print(f"  ✓ saved → {OUT_PATH}")

    print(f"\nDone. {len(results)} companies in {OUT_PATH}")


if __name__ == "__main__":
    main()
