# Iteration log — legal_tech_saas_v1

Living log of every run and what it taught us. Append, don't edit.

## Run 1 — 2026-04-19 — Baseline (failed validation)

**Filters proposed**
- `COMPANY_HEADCOUNT: ['51-200','201-500','501-1000']`
- `INDUSTRY: ['Computer Software','Information Technology & Services','Legal Services']`
- `REGION: ['United States','Canada','United Kingdom','Australia']`
- `TECHNOLOGIES_USED: ['Salesforce','HubSpot','Outreach.io']`
- `COMPANY_TYPE: ['Private']`

**Pre-flight (5 ground-truth companies)**: 0/5 would be included.

**Search**: HTTP 400.

**What we learned from the 400 response (this is the payoff of doing pre-flight):**
1. `COMPANY_HEADCOUNT` values require **commas**: `'501-1,000'` not `'501-1000'`.
2. `COMPANY_TYPE` **is not a company-search filter** — it's a people-search filter. Valid company-search filters are:
   `COMPANY_HEADCOUNT, REGION, INDUSTRY, NUM_OF_FOLLOWERS, DEPARTMENT_HEADCOUNT_GROWTH, FORTUNE, TECHNOLOGIES_USED, COMPANY_HEADCOUNT_GROWTH, ANNUAL_REVENUE, DEPARTMENT_HEADCOUNT, ACCOUNT_ACTIVITIES, JOB_OPPORTUNITIES`.
3. `TECHNOLOGIES_USED: "Salesforce"` → `"Correct values are []"` — likely plan-gated.
4. `INDUSTRY: "Computer Software"` not in Crustdata's enum — uses internal taxonomy, not LinkedIn's raw labels.
5. Enrichment records return `hq_country: "USA"` and `company_type: "Privately Held"` — watch out for case/alias normalization when comparing to filter values.

**Fixes applied to code & docs**
- Script: comma-formatted headcount buckets, dropped `COMPANY_TYPE` from company search, added country-alias map (`"USA"` → `"united states"`), added field accessors since search and enrich return different field names.
- Docs: `filter-reference.md` updated with scope (which filters belong to which endpoint).

## Run 2 — Reduced filters (pre-flight passes, search precision 0)

**Filters**: only `COMPANY_HEADCOUNT` + `REGION`.

- **Pre-flight**: 5/5 ✅
- **Search**: 25 results ✅
- **Precision against ICP**: ~0. Results were Nasty Gal (apparel), financial services, staffing firms. No legal tech.

**Learned**
- Removing filters = pre-flight passes, but the list is useless for vertical-specific ICP.
- `INDUSTRY` in search output returns Crustdata's canonical values — e.g. `"Software Development"` (the B2B SaaS umbrella). Discovery recipe: run with only HEADCOUNT, read the `industry` strings, and use those for the filter.

## Run 3 — Added `INDUSTRY: "Software Development"` + vertical keyword post-filter

**Filters**: `COMPANY_HEADCOUNT` + `INDUSTRY: ["Software Development"]` + `REGION`.

**New in the evaluator:**
- `description_keywords_any: ["legal","law firm","attorney","lawyer","case management","practice management","e-discovery"]`
- `description_keywords_none: ["game studio","consumer"]`
- Ground-truth-in-results check

**Results:**
- Pre-flight: 5/5 ✅
- Search: 25 results
- Passed all checks: **0/25**
- Ground-truth companies in results: **0/5**
- Failure breakdown: `description_keyword_miss = 25` (all results failed the vertical check)

Sample: Ultimate Software, TechCrunch, Hugging Face, Kickstarter, Square Enix, Skype, Evernote, Stack Overflow, VentureBeat, DeepLearning.AI, AOL. Nothing legal-related.

**The honest diagnosis**
> Crustdata's company search filters cannot isolate a narrow vertical (like "legal tech SaaS"). `INDUSTRY: "Software Development"` is an umbrella ~50k companies deep, with no axis to cut to legal. The default page-1 sort returns well-known general-purpose SaaS, not vertical-specific mid-market. Even widening the industry list won't help — the taxonomy has no "legal tech" leaf.

**Recommended pivot for this ICP**

Don't use search-based discovery. Use one of these three strategies:

1. **Enrich a known list** (fastest). User already has `outreach_list.csv` with 11 legal-tech companies. Enrich each via `/screener/company?company_domain=X`, score against ICP, then find signals.
2. **`/web/search/live` discovery** — queries like `"legal practice management software" site:linkedin.com/company` returned via the live web search. Parse company names, then enrich.
3. **Use known competitor companies** and find adjacent ones. E.g., enrich "Clio" to get employee list, then do people-search for similar titles at similar companies.

The next iteration should pivot to strategy 1.

---

## Takeaways for the questionnaire

Update `icp-questionnaire.md` to include:
- Warning: if your vertical is narrow, filter-based discovery will not work. Provide a seed list instead.
- Add "mode" field: `discovery` vs `enrich_known_list` vs `adjacent_to_seed`.

## Takeaways for the strategy doc

Add explicit note: "Crustdata company search is good for broad-attribute sorts (company size, geography, tech stack). It is bad for vertical-specific list-building. Industry taxonomy does not have vertical leaves like 'legal tech'."
