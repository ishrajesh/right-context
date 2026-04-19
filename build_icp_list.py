"""
ICP → Crustdata filter query → validated list.

Usage:
  python3 build_icp_list.py --icp icp/legal_tech_example.yaml --dry-run
  python3 build_icp_list.py --icp icp/legal_tech_example.yaml
  python3 build_icp_list.py --icp icp/legal_tech_example.yaml --skip-preflight
  python3 build_icp_list.py --icp icp/legal_tech_example.yaml --limit 20

The script is deliberately conservative — every stage prints what it will do
and saves results incrementally, so you can Ctrl-C without losing work.

See docs/filter-strategy.md for the translation rules and docs/feedback-loop.md
for the evaluation methodology.
"""

import argparse
import json
import socket
import sys
import time
from pathlib import Path

import requests
import yaml
from typing import List, Dict, Optional, Tuple

# --- IPv4-only (AAAA hangs on this network for api.crustdata.com) ---
_orig_getaddrinfo = socket.getaddrinfo
socket.getaddrinfo = lambda h, *a, **k: [
    x for x in _orig_getaddrinfo(h, *a, **k) if x[0] == socket.AF_INET
]

ROOT = Path(__file__).parent
ENV_PATH = ROOT / ".env"
OUT_DIR = ROOT / "out"
OUT_DIR.mkdir(exist_ok=True)
BASE = "https://api.crustdata.com"

HEADCOUNT_BUCKETS = [
    ("1-10", 1, 10),
    ("11-50", 11, 50),
    ("51-200", 51, 200),
    ("201-500", 201, 500),
    ("501-1,000", 501, 1000),
    ("1,001-5,000", 1001, 5000),
    ("5,001-10,000", 5001, 10000),
    ("10,001+", 10001, 10_000_000),
]

# Learned from API 400 responses — see docs/filter-reference.md
COMPANY_SEARCH_VALID_FILTERS = {
    "COMPANY_HEADCOUNT", "REGION", "INDUSTRY", "NUM_OF_FOLLOWERS",
    "DEPARTMENT_HEADCOUNT_GROWTH", "FORTUNE", "TECHNOLOGIES_USED",
    "COMPANY_HEADCOUNT_GROWTH", "ANNUAL_REVENUE", "DEPARTMENT_HEADCOUNT",
    "ACCOUNT_ACTIVITIES", "JOB_OPPORTUNITIES",
}

# Country name normalizations observed in enrichment vs. filter values.
COUNTRY_ALIASES = {
    "usa": "united states",
    "us": "united states",
    "u.s.": "united states",
    "uk": "united kingdom",
    "u.k.": "united kingdom",
}

def normalize_country(s: str) -> str:
    s = (s or "").strip().lower()
    return COUNTRY_ALIASES.get(s, s)


# Field accessors — enrich and search responses use different keys.
def field_name(c: dict) -> str:
    return c.get("name") or c.get("company_name") or ""

def field_industry(c: dict) -> str:
    return c.get("industry") or c.get("linkedin_industries") or ""

def field_country(c: dict) -> str:
    hq = c.get("headquarters")
    if isinstance(hq, dict) and hq.get("country"):
        return hq["country"]
    return c.get("hq_country") or ""

def field_headcount_range(c: dict) -> Optional[str]:
    return c.get("employee_count_range") or c.get("headcount_range")

def field_headcount(c: dict):
    return c.get("employee_count") or c.get("headcount")

def field_website(c: dict) -> str:
    return c.get("website") or c.get("company_website") or ""

def field_linkedin(c: dict) -> str:
    return c.get("linkedin_company_url") or c.get("linkedin_profile_url") or ""


# ------------------------------------------------------------------ helpers
def load_env(path: Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def headers_from_env() -> dict:
    env = load_env(ENV_PATH)
    key = env.get("CRUSTDATA_API_KEY")
    if not key:
        sys.exit("CRUSTDATA_API_KEY not set in .env")
    return {"Authorization": f"Token {key}", "Content-Type": "application/json"}


def map_headcount_buckets(mn: Optional[int], mx: Optional[int]) -> List[str]:
    if mn is None and mx is None:
        return []
    mn = mn or 1
    mx = mx or 10_000_000
    return [label for label, lo, hi in HEADCOUNT_BUCKETS if not (hi < mn or lo > mx)]


def _http(method: str, url: str, headers: dict, **kw):
    try:
        r = requests.request(method, url, headers=headers, timeout=180, **kw)
        try:
            return {"status": r.status_code, "data": r.json()}
        except Exception:
            return {"status": r.status_code, "data": r.text[:2000]}
    except requests.exceptions.RequestException as e:
        return {"status": None, "error": str(e)}


def enrich_company(domain: str, headers: dict):
    return _http(
        "GET",
        f"{BASE}/screener/company",
        headers,
        params={"company_domain": domain},
    )


def company_search(filters: List[dict], headers: dict, page: int = 1):
    return _http(
        "POST",
        f"{BASE}/screener/company/search",
        headers,
        json={"filters": filters, "page": page},
    )


def web_search(query: str, headers: dict):
    return _http("POST", f"{BASE}/screener/web-search", headers, json={"query": query})


# --------------------------------------------------- filter proposal logic
def propose_filters(icp: dict) -> List[dict]:
    """Return list of {filter, rationale}. See docs/filter-strategy.md."""
    proposals: List[dict] = []
    c = icp.get("company") or {}

    size = c.get("size") or {}
    mn, mx = size.get("headcount_min"), size.get("headcount_max")
    buckets = map_headcount_buckets(mn, mx)
    if buckets:
        proposals.append({
            "filter": {"filter_type": "COMPANY_HEADCOUNT", "type": "in", "value": buckets},
            "rationale": f"Size {mn}-{mx} employees → buckets {buckets}",
        })

    inds = c.get("example_industries") or []
    if inds:
        proposals.append({
            "filter": {"filter_type": "INDUSTRY", "type": "in", "value": inds},
            "rationale": f"{len(inds)} LinkedIn industry labels (coarse — include all plausible)",
        })

    geo = c.get("geography") or {}
    countries = geo.get("countries") or []
    if countries:
        proposals.append({
            "filter": {"filter_type": "REGION", "type": "in", "value": countries},
            "rationale": f"Target countries: {countries}",
        })
    regions = geo.get("regions_or_states") or []
    if regions:
        proposals.append({
            "filter": {"filter_type": "COMPANY_HEADQUARTERS", "type": "in", "value": regions},
            "rationale": f"Metro-level geo: {regions}",
        })

    tech = (c.get("tech_stack") or {}).get("uses") or []
    if tech:
        proposals.append({
            "filter": {"filter_type": "TECHNOLOGIES_USED", "type": "in", "value": tech},
            "rationale": f"HIGHEST-PRECISION filter: tech stack {tech}",
        })

    # NOTE: COMPANY_TYPE is NOT a company-search filter (only people-search).
    # Learned from API 400 response. See docs/filter-reference.md §Scope.

    # Drop any proposed filter whose type isn't a valid company-search filter.
    valid = [p for p in proposals if p["filter"]["filter_type"] in COMPANY_SEARCH_VALID_FILTERS]
    dropped = [p for p in proposals if p["filter"]["filter_type"] not in COMPANY_SEARCH_VALID_FILTERS]
    for d in dropped:
        print(f"  [skip] {d['filter']['filter_type']} not valid for company search — dropped")
    return valid


def propose_person_filters(icp: dict) -> List[dict]:
    proposals: List[dict] = []
    p = icp.get("person") or {}

    titles = []
    for key in ("buyer_titles", "champion_titles", "user_titles"):
        titles.extend(p.get(key) or [])
    titles = list({t for t in titles if t})
    if titles:
        proposals.append({
            "filter": {"filter_type": "CURRENT_TITLE", "type": "in", "value": titles},
            "rationale": f"{len(titles)} title keywords (OR'd, keyword match not exact)",
        })

    if p.get("seniority_levels"):
        proposals.append({
            "filter": {"filter_type": "SENIORITY_LEVEL", "type": "in", "value": p["seniority_levels"]},
            "rationale": f"Seniority: {p['seniority_levels']}",
        })

    if p.get("functions"):
        proposals.append({
            "filter": {"filter_type": "FUNCTION", "type": "in", "value": p["functions"]},
            "rationale": f"Functions: {p['functions']}",
        })

    exp = p.get("experience") or {}
    if exp.get("min_years_in_role"):
        proposals.append({
            "filter": {
                "filter_type": "YEARS_IN_CURRENT_POSITION",
                "type": "between",
                "value": {"min": exp["min_years_in_role"], "max": 99},
            },
            "rationale": f"Min {exp['min_years_in_role']}yr in current role (tenure signal)",
        })
    if exp.get("recently_changed_jobs"):
        proposals.append({
            "filter": {"filter_type": "RECENTLY_CHANGED_JOBS", "type": "in", "value": [True]},
            "rationale": "Recent job change trigger",
        })

    return proposals


# ------------------------------------------------- pre-flight ground-truth
def company_bucket_for_headcount(hc) -> Optional[str]:
    try:
        hc = int(hc)
    except (TypeError, ValueError):
        return None
    for label, lo, hi in HEADCOUNT_BUCKETS:
        if lo <= hc <= hi:
            return label
    return None


def check_would_match(enriched: dict, filters: List[dict]) -> dict:
    """Test if an enriched company record would satisfy the filter query.
    Returns {match: bool, excluded_by: [filter_type, ...], reasons: [...]}."""
    excluded, reasons = [], []
    for flt in filters:
        ft = flt["filter_type"]
        vals = flt["value"]

        if ft == "COMPANY_HEADCOUNT":
            # Prefer the range string the API already produced; fall back to int-derived bucket.
            bucket = field_headcount_range(enriched) or company_bucket_for_headcount(field_headcount(enriched))
            if not bucket:
                reasons.append(f"  · {ft}: headcount missing on record — unknown")
                continue
            if bucket not in vals:
                excluded.append(ft)
                reasons.append(f"  · {ft}: company is '{bucket}', filter has {vals}")

        elif ft == "INDUSTRY":
            actual = field_industry(enriched)
            if actual and not any(str(v).lower() in str(actual).lower() for v in vals):
                excluded.append(ft)
                reasons.append(f"  · {ft}: company is '{actual}', filter has {vals}")

        elif ft == "REGION":
            actual_raw = field_country(enriched)
            actual = normalize_country(actual_raw)
            wanted = {normalize_country(v) for v in vals}
            if actual and actual not in wanted:
                excluded.append(ft)
                reasons.append(f"  · {ft}: HQ '{actual_raw}' not in {vals}")

        elif ft == "TECHNOLOGIES_USED":
            tech = enriched.get("technologies") or enriched.get("tech_stack") or []
            if isinstance(tech, list) and tech:
                if not any(t.lower() in (x.lower() for x in tech) for t in vals):
                    excluded.append(ft)
                    reasons.append(f"  · {ft}: tech {tech[:5]}… doesn't include any of {vals}")

    return {"match": not excluded, "excluded_by": excluded, "reasons": reasons}


def preflight(icp: dict, filters: List[dict], headers: dict, delay: float = 1.0) -> List[dict]:
    gt = ((icp.get("ground_truth") or {}).get("perfect_fit_companies")) or []
    out: List[dict] = []
    for row in gt:
        name = row.get("name") or ""
        domain = row.get("domain") or ""
        if not domain:
            out.append({"name": name, "skipped": "no domain in ICP yaml"})
            continue
        print(f"  [enrich] {name} ({domain})")
        result = enrich_company(domain, headers)
        data = result.get("data")
        if result.get("status") != 200 or not isinstance(data, list) or not data:
            out.append({"name": name, "domain": domain, "error": f"enrich failed: {result.get('status')}"})
            time.sleep(delay)
            continue
        enriched = data[0]
        check = check_would_match(enriched, filters)
        out.append({
            "name": name,
            "domain": domain,
            "enriched": {
                "name": field_name(enriched),
                "headcount": field_headcount(enriched),
                "headcount_range": field_headcount_range(enriched),
                "hq_country": field_country(enriched),
                "industry": field_industry(enriched),
                "year_founded": enriched.get("year_founded") or enriched.get("founded_year"),
                "company_type": enriched.get("company_type"),
            },
            "check": check,
        })
        time.sleep(delay)
    return out


# -------------------------------------------------------- post-query evaluator
def evaluate(icp: dict, results: List[dict]) -> dict:
    c_cfg = icp.get("company") or {}
    disq = c_cfg.get("disqualifiers") or {}
    ex_inds = [s.lower() for s in (disq.get("exclude_industries") or [])]
    ex_countries = [s.lower() for s in (disq.get("exclude_countries") or [])]
    ex_companies = [s.lower() for s in (disq.get("exclude_companies") or [])]
    ex_under = disq.get("exclude_size_under")
    ex_over = disq.get("exclude_size_over")

    kw_any = [s.lower() for s in (c_cfg.get("description_keywords_any") or [])]
    kw_none = [s.lower() for s in (c_cfg.get("description_keywords_none") or [])]

    gt_names = {(g.get("name") or "").lower() for g in
                ((icp.get("ground_truth") or {}).get("perfect_fit_companies") or [])}
    gt_hits = []

    flags = {
        "wrong_industry": 0,
        "too_small": 0,
        "too_large": 0,
        "wrong_country": 0,
        "excluded_company": 0,
        "description_keyword_miss": 0,   # NEW — vertical mismatch
        "description_negative_hit": 0,   # NEW — disqualifier keyword found
        "missing_website": 0,
        "missing_linkedin": 0,
    }
    passed = []

    for c in results:
        name = field_name(c).lower()
        ind = field_industry(c).lower()
        country = normalize_country(field_country(c))
        hc = field_headcount(c)

        bad = False
        if any(n in name or name in n for n in ex_companies):
            flags["excluded_company"] += 1
            bad = True
        if ex_inds and any(ind_x in ind for ind_x in ex_inds):
            flags["wrong_industry"] += 1
            bad = True
        if ex_countries and country in ex_countries:
            flags["wrong_country"] += 1
            bad = True
        try:
            hc_int = int(hc) if hc is not None else None
        except (TypeError, ValueError):
            hc_int = None
        if hc_int is not None and ex_under and hc_int < ex_under:
            flags["too_small"] += 1
            bad = True
        if hc_int is not None and ex_over and hc_int > ex_over:
            flags["too_large"] += 1
            bad = True

        # Vertical-specificity post-filter on description
        desc = str(c.get("description") or "").lower()
        blob = f"{name} {desc}"
        if kw_any and not any(k in blob for k in kw_any):
            flags["description_keyword_miss"] += 1
            bad = True
        if kw_none and any(k in blob for k in kw_none):
            flags["description_negative_hit"] += 1
            bad = True

        if not field_website(c):
            flags["missing_website"] += 1
        if not field_linkedin(c):
            flags["missing_linkedin"] += 1

        if name and any(g in name or name in g for g in gt_names if g):
            gt_hits.append(field_name(c))

        if not bad:
            passed.append(c)

    total = len(results) or 1
    return {
        "total": len(results),
        "passed_all_checks": len(passed),
        "precision_rough": round(len(passed) / total, 2),
        "failure_counts": flags,
        "ground_truth_companies_in_results": gt_hits,
    }


# ------------------------------------------------------------ reporting
def print_proposal(company_props, person_props):
    print("\n=== PROPOSED FILTERS ===\n")
    print("COMPANY SEARCH filters:")
    if not company_props:
        print("  (none — add more ICP fields)")
    for p in company_props:
        print(f"  • {p['filter']['filter_type']}: {p['filter']['value']}")
        print(f"      ↳ {p['rationale']}")
    print("\nPERSON SEARCH filters:")
    if not person_props:
        print("  (none)")
    for p in person_props:
        print(f"  • {p['filter']['filter_type']}: {p['filter']['value']}")
        print(f"      ↳ {p['rationale']}")
    print()


def write_report(path: Path, icp: dict, company_props, person_props,
                 preflight_results, search_result, eval_summary, signals_results):
    lines = []
    w = lines.append
    w(f"# ICP build report — {icp.get('name')}")
    w("")
    w(f"**Product:** {icp.get('product_description', '').strip()}")
    w("")
    w("## Proposed filters")
    w("")
    w("### Company")
    for p in company_props:
        w(f"- **{p['filter']['filter_type']}** = `{p['filter']['value']}`  — {p['rationale']}")
    w("")
    w("### Person")
    for p in person_props:
        w(f"- **{p['filter']['filter_type']}** = `{p['filter']['value']}`  — {p['rationale']}")
    w("")
    w("## Pre-flight ground-truth match")
    w("")
    w("| Company | Included by filters? | Missing |")
    w("|---|---|---|")
    for r in preflight_results or []:
        if r.get("skipped"):
            w(f"| {r['name']} | ⚠️ skipped | {r['skipped']} |")
            continue
        if r.get("error"):
            w(f"| {r['name']} | ❌ error | {r['error']} |")
            continue
        ok = r["check"]["match"]
        missing = ", ".join(r["check"]["excluded_by"]) or "—"
        w(f"| {r['name']} | {'✅' if ok else '❌'} | {missing} |")
    w("")
    w("## Company search result")
    w("")
    if search_result is None:
        w("_(not run — dry-run or skipped)_")
    else:
        w(f"- HTTP: {search_result.get('status')}")
        data = search_result.get("data") or {}
        if isinstance(data, dict):
            w(f"- Keys in response: `{list(data.keys())}`")
        if eval_summary:
            w(f"- Total returned: **{eval_summary['total']}**")
            w(f"- Passed all checks (incl. vertical keywords): **{eval_summary['passed_all_checks']}**")
            w(f"- Rough precision: **{eval_summary['precision_rough']}**")
            gt_hits = eval_summary.get("ground_truth_companies_in_results") or []
            w(f"- Ground-truth companies present in results: **{len(gt_hits)}** — {gt_hits or '—'}")
            w("- Failure breakdown:")
            for k, v in (eval_summary["failure_counts"] or {}).items():
                if v:
                    w(f"  - {k}: {v}")
    w("")
    w("## Intent signals (web/search/live)")
    w("")
    for q, sr in (signals_results or []):
        w(f"### Query: `{q}`")
        if sr.get("status") != 200:
            w(f"- HTTP {sr.get('status')}")
            w("")
            continue
        results = ((sr.get("data") or {}).get("results")) or []
        w(f"- {len(results)} results")
        for r in results[:5]:
            w(f"  - [{r.get('title','?')}]({r.get('url','')}) — {r.get('snippet','')[:150]}")
        w("")

    path.write_text("\n".join(lines))
    print(f"  ✓ report → {path}")


# --------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--icp", required=True, help="Path to ICP yaml")
    ap.add_argument("--dry-run", action="store_true", help="Show proposal + exit")
    ap.add_argument("--skip-preflight", action="store_true")
    ap.add_argument("--skip-search", action="store_true")
    ap.add_argument("--skip-signals", action="store_true")
    ap.add_argument("--limit", type=int, default=10,
                    help="Limit signal-query count (keeps credits low)")
    args = ap.parse_args()

    icp_path = Path(args.icp)
    if not icp_path.exists():
        sys.exit(f"Missing {icp_path}")
    icp = yaml.safe_load(icp_path.read_text())
    name = icp.get("name") or icp_path.stem

    company_props = propose_filters(icp)
    person_props = propose_person_filters(icp)
    print_proposal(company_props, person_props)

    if args.dry_run:
        print("(dry-run — no API calls)")
        return

    headers = headers_from_env()
    company_filters = [p["filter"] for p in company_props]
    out_json = OUT_DIR / f"{name}_results.json"
    out_md = OUT_DIR / f"{name}_report.md"

    collected: dict = {"icp_name": name, "proposal": {"company": company_props, "person": person_props}}

    # pre-flight
    preflight_results = None
    if not args.skip_preflight:
        print("=== PRE-FLIGHT: checking ground-truth companies ===")
        preflight_results = preflight(icp, company_filters, headers)
        passed = sum(1 for r in preflight_results if r.get("check", {}).get("match"))
        total = sum(1 for r in preflight_results if "check" in r)
        print(f"\n  {passed}/{total} perfect-fit companies would be included by the filter")
        collected["preflight"] = preflight_results
        out_json.write_text(json.dumps(collected, indent=2, default=str))

    # search
    search_result, eval_summary = None, None
    if not args.skip_search and company_filters:
        print("\n=== COMPANY SEARCH (page 1) ===")
        search_result = company_search(company_filters, headers, page=1)
        collected["company_search"] = search_result
        if search_result.get("status") == 200:
            data = search_result.get("data") or {}
            companies = data.get("companies") if isinstance(data, dict) else None
            if companies:
                eval_summary = evaluate(icp, companies)
                collected["evaluation"] = eval_summary
                gt = eval_summary.get("ground_truth_companies_in_results") or []
                print(f"  returned {eval_summary['total']} → {eval_summary['passed_all_checks']} pass checks "
                      f"(rough precision {eval_summary['precision_rough']})  |  gt-hits={len(gt)}")
        else:
            print(f"  HTTP {search_result.get('status')} — see out/{name}_results.json")
        out_json.write_text(json.dumps(collected, indent=2, default=str))

    # signals
    signals_results = []
    if not args.skip_signals:
        queries = build_signal_queries(icp)[: args.limit]
        if queries:
            print(f"\n=== INTENT SIGNALS ({len(queries)} queries) ===")
            for q in queries:
                print(f"  [web_search] {q}")
                sr = web_search(q, headers)
                signals_results.append((q, sr))
                time.sleep(1)
            collected["signals"] = [{"query": q, "response": r} for q, r in signals_results]
            out_json.write_text(json.dumps(collected, indent=2, default=str))

    write_report(out_md, icp, company_props, person_props,
                 preflight_results, search_result, eval_summary, signals_results)
    print(f"\nDone → {out_json}  +  {out_md}")


def build_signal_queries(icp: dict) -> List[str]:
    s = icp.get("signals") or {}
    pains = s.get("pain_phrases") or []
    comps = s.get("competitor_names") or []
    triggers = s.get("trigger_events") or []
    hiring = s.get("hiring_signals") or []

    q: List[str] = []
    for phrase in pains:
        q.append(f'"{phrase}"')
    for comp in comps:
        q.append(f'"{comp} alternative" OR "switching from {comp}"')
    for trig in triggers:
        q.append(f'"{trig}" {(icp.get("company") or {}).get("segments", [""])[0]}')
    for h in hiring:
        q.append(f'site:linkedin.com/jobs "{h}"')
    return q


if __name__ == "__main__":
    main()
