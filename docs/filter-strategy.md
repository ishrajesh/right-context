# ICP → Filter Strategy

How to translate the answers in `icp-questionnaire.md` into a concrete Crustdata filter query, and how to handle the cases Crustdata can't answer directly.

## 1. The translation table

| ICP answer (human) | Crustdata filter(s) | Notes |
|---|---|---|
| `headcount_min / max` | `COMPANY_HEADCOUNT` | Map to enum bucket — round outward if you're unsure (prefer wider bucket than narrower). |
| `segments` / `example_industries` | `INDUSTRY` | LinkedIn labels, coarse. Use *all plausible* labels, not one. |
| `countries` | `REGION` | Country names. |
| `regions_or_states` | `COMPANY_HEADQUARTERS` | Metro-level. |
| `uses_technologies` | `TECHNOLOGIES_USED` with `type: in` | High precision when available. |
| `does_not_use` | `TECHNOLOGIES_USED` with `type: not_in` (if supported) OR post-filter after enrichment | Confirm operator support first. |
| `revenue_range` | `ANNUAL_REVENUE` | Enum bucket. |
| `company_type` | `COMPANY_TYPE` | |
| `growth_signals: hiring fast` | `COMPANY_HEADCOUNT_GROWTH > X%` or `JOB_OPPORTUNITIES` | Numeric threshold — start at `>15%` and tune. |
| `growth_signals: in the news for X` | `IN_THE_NEWS` | Topic enum. |
| `buyer_titles` | `CURRENT_TITLE` with title keywords OR'd | Keywords, not exact-match. |
| `functions` | `FUNCTION` | |
| `seniority_levels` | `SENIORITY_LEVEL` | |
| `min_years_in_role` | `YEARS_IN_CURRENT_POSITION: gte N` | |
| `recently_changed_jobs: true` | `RECENTLY_CHANGED_JOBS: true` | Combined with funding/news is gold. |
| `exclude_industries` | Post-filter after results (or second pass) | No `not_in` for INDUSTRY as far as we know. |
| `exclude_companies` | Post-filter | Filter out by name/domain after fetch. |

## 2. Rules for choosing filters well

**Rule 1: Start with the narrowest confident signal.** If the ICP says "uses Salesforce", start there — that's a hard precision filter. Add softer filters (industry, geo) after. Don't start with INDUSTRY; it's the noisiest single axis.

**Rule 2: Use OR'd enumerations, not single values.** For INDUSTRY, include every plausible LinkedIn label. Example — "legal tech" should map to `["Legal Services", "Law Practice", "Computer Software", "Information Technology & Services"]` because legal tech vendors sit in "Software" and their customers sit in "Legal Services".

**Rule 3: Widen buckets, not narrow them.** If the ideal size is 200 employees, use `"51-200"` + `"201-500"`, not one bucket. Edge cases are where real fits live.

**Rule 4: Don't combine >5 filters on the first pass.** Stack too many and you get zero results. Sequence: 2-3 filters → see results → add specificity based on what you see.

**Rule 5: Treat `TECHNOLOGIES_USED` as your highest-precision filter.** When applicable, it often does more work than INDUSTRY + REGION combined.

**Rule 6: For people search, title keywords beat FUNCTION.** FUNCTION is coarse. If you want "RevOps leaders", `CURRENT_TITLE in ["RevOps", "Revenue Operations", "Sales Operations"]` beats `FUNCTION = Operations`.

## 3. Handling Crustdata's known gaps

### Gap: No B2B/B2C filter
**Workaround.** Most B2B-only signals cluster around: `TECHNOLOGIES_USED in [Salesforce/HubSpot/Outreach]`, `COMPANY_TYPE = Private`, `INDUSTRY` in software/services. DTC/B2C clusters around consumer goods, retail, and different tech stacks (Shopify). Combine filters until you see the right mix, then verify with a sample.

### Gap: No funding-stage filter
**Workaround.** Proxy with `COMPANY_HEADCOUNT` + `ANNUAL_REVENUE` + `IN_THE_NEWS: Funding`:
- Pre-seed / Seed → 1-10 headcount, no revenue bucket, recent "Funding" news
- Series A → 11-50, revenue <$10M
- Series B → 51-200, $1-10M or $10-50M
- Series C+ → 201-500+, revenue bucket tightens

### Gap: Vertical specificity (e.g., "legal tech SaaS" vs "law firm")
**Workaround.** Two-stage:
1. Broad INDUSTRY pull (Software + Legal Services).
2. Post-enrich each result and scan the `company_description` / `linkedin_description` for keywords ("software for lawyers", "case management").

### Gap: Website / product detail
**Workaround.** Use `/web/search/live` with queries like `"{company} legal case management software"` to verify product type; parse returned snippets.

## 4. Intent signals via `/web/search/live` (not a filter)

Every ICP should produce 3-5 **signal queries** that run against the web search API. These surface buying triggers and pain statements — the highest-leverage input for outreach.

| Intent | Query template |
|---|---|
| Competitor churn | `"migrating from {competitor}" OR "switching from {competitor}" OR "{competitor} alternative"` |
| Pain statement | `"struggling with {pain}" site:reddit.com OR site:news.ycombinator.com` |
| Hiring signal | `site:linkedin.com/jobs "{ideal role}" "{target vertical}"` |
| Product launch | `"{company} launches" OR "{company} announces"` |
| Funding | `"{company} raises" OR "{company} series"` |

Each query hits `/screener/web-search` and returns a list. The outreach message references the specific result found — this is the 1%→10% reply-rate lift.

## 5. Query-building recipe

Given a filled `icp/*.yaml`:

1. **Extract hard filters** (headcount, industry, geo, tech). These become the base query.
2. **Extract person filters** separately. Company search gets base + company-only filters; person search gets base + person filters (`CURRENT_TITLE`, `FUNCTION`, `SENIORITY_LEVEL`).
3. **Pre-flight validate** against `perfect_fit_companies` (see `feedback-loop.md` §1).
4. **Run with `page=1, limit=10`** first. Never run a full pull before validating a sample.
5. **Post-filter** for disqualifiers (exclude_industries, exclude_companies).
6. **Diagnose + iterate** per `feedback-loop.md`.

## 6. What the executor (`build_icp_list.py`) does

- Loads `icp/*.yaml`.
- Generates a proposed filter query, prints it with *rationale per filter* so you can sanity-check before spending credits.
- On `--dry-run`, stops here.
- Otherwise: runs pre-flight (enrich each perfect-fit company, check they match the query), then runs the actual search.
- Calls `/web/search/live` for each signal query.
- Writes results to `out/{icp_name}.json` + a markdown eval report.
