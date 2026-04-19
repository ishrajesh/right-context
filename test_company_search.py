"""
Quick test of Crustdata company APIs on one company.

Tries two approaches:
  1) /screener/company?company_domain=...   (enrichment by domain — simplest)
  2) /screener/company/search               (filter-based search by name)
"""

import json
import socket
import sys
from pathlib import Path

import requests

# Force IPv4 (AAAA hangs on this network)
_orig = socket.getaddrinfo
socket.getaddrinfo = lambda h, *a, **k: [x for x in _orig(h, *a, **k) if x[0] == socket.AF_INET]

ENV = Path(__file__).parent / ".env"
key = None
for line in ENV.read_text().splitlines():
    if line.startswith("CRUSTDATA_API_KEY="):
        key = line.split("=", 1)[1].strip().strip('"').strip("'")
if not key:
    sys.exit("CRUSTDATA_API_KEY not set in .env")

BASE = "https://api.crustdata.com"
HEADERS = {"Authorization": f"Token {key}", "Content-Type": "application/json"}

# --- 1) Enrich by domain ------------------------------------------------------
print("=" * 70)
print("1) /screener/company  (enrich by domain)")
print("=" * 70)
domain = "joinparadigm.com"  # PracticePanther (Paradigm) from your CSV
print(f"domain = {domain}\n")

r = requests.get(f"{BASE}/screener/company", params={"company_domain": domain}, headers=HEADERS, timeout=120)
print(f"HTTP {r.status_code}\n")
try:
    data = r.json()
    if isinstance(data, list) and data:
        c = data[0]
        print(f"  name         : {c.get('company_name')}")
        print(f"  website      : {c.get('company_website')}")
        print(f"  hq           : {c.get('hq_country')}, {c.get('hq_city')}")
        print(f"  headcount    : {c.get('headcount')}")
        print(f"  linkedin     : {c.get('linkedin_profile_url')}")
        print(f"  founded      : {c.get('year_founded')}")
        print(f"  industry     : {c.get('linkedin_industries') or c.get('industry')}")
        print(f"  description  : {(c.get('linkedin_description') or '')[:200]}...")
        print(f"\n  (full record has {len(c)} fields)")
    else:
        print(json.dumps(data, indent=2)[:1500])
except Exception as e:
    print(f"parse error: {e}")
    print(r.text[:500])

# --- 2) Search by name filter -------------------------------------------------
print("\n" + "=" * 70)
print("2) /screener/company/search  (filter search by name)")
print("=" * 70)
company_name = "FreshBooks"
body = {
    "filters": [{"filter_type": "COMPANY_NAME", "type": "in", "value": [company_name]}],
    "page": 1,
}
print(f"body = {json.dumps(body)}\n")

r = requests.post(f"{BASE}/screener/company/search", json=body, headers=HEADERS, timeout=120)
print(f"HTTP {r.status_code}\n")
try:
    data = r.json()
    if isinstance(data, dict) and "companies" in data:
        hits = data["companies"]
        print(f"  {len(hits)} hits")
        for c in hits[:3]:
            print(f"    - {c.get('company_name')}  | {c.get('company_website')}  | hc={c.get('headcount')}")
    else:
        print(json.dumps(data, indent=2)[:1500])
except Exception as e:
    print(f"parse error: {e}")
    print(r.text[:500])

Path("company_test_result.json").write_text(r.text)
print(f"\nraw response saved → company_test_result.json")
