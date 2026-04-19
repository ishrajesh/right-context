# ICP Questionnaire

**Purpose.** Crustdata has ~30 filter types. Most users don't know which combination matches their ICP, and when results come back, it's hard to tell *why* a bad result slipped through. This questionnaire captures the ICP in plain English; the strategy doc (`filter-strategy.md`) translates it into Crustdata filters; the feedback loop (`feedback-loop.md`) validates the results and suggests corrections.

**How to use.**
1. Answer the questions in `icp/template.yaml` (copy it, rename, and fill in).
2. Run `python3 build_icp_list.py --icp icp/your_file.yaml --dry-run` to see the proposed filter query *before* spending credits.
3. Run without `--dry-run` to execute and get an evaluated list.

---

## Section 1 — Your product (context only)

Not used for filters. Used by the evaluator to reason about fit.

- **product_description**: What you sell, in 2-3 sentences. Plain English.
- **value_prop**: The one specific pain you solve.
- **replaces_or_complements**: What existing tools does your product replace or plug alongside? (e.g., "replaces HubSpot Sales Hub", "plugs into Salesforce")

## Section 2 — Ideal customer (company)

### 2.1 Size
- **headcount_min / headcount_ideal / headcount_max** — employees
- **revenue_range** — optional (e.g., "$10M-$100M ARR")

### 2.2 Industry / segment
- **segments** — list of verticals you sell into (e.g., "legal tech", "construction field ops")
- **example_industries** — LinkedIn-style industry labels if you know them (e.g., "Law Practice", "Construction"). If you don't, leave blank.

### 2.3 Geography
- **countries** — list of country names
- **regions_or_states** — optional, for tighter targeting

### 2.4 Business model signals
- **business_model** — B2B SaaS / DTC / Enterprise / Marketplace / Agency / Services
- **sells_to** — who does *your target customer* sell to? Often a strong filter signal.

### 2.5 Tech stack (optional, very powerful)
- **uses_technologies** — tools they use (competitors or complementary)
- **does_not_use** — tools they *don't* use (negative filter)

### 2.6 Growth stage (optional)
- **company_type** — private / public / nonprofit
- **funding_stage_notes** — Crustdata doesn't have a direct funding-stage filter; describe in free text and we'll use proxies (headcount, revenue, news)
- **growth_signals** — "hiring fast", "recently funded", "in the news for X"

### 2.7 Disqualifiers (negative ICP)
- **exclude_industries**
- **exclude_countries**
- **exclude_size_under** / **exclude_size_over**
- **exclude_companies** — specific names (competitors, current customers, partners)

## Section 3 — Ground truth (the single most valuable input)

If you can only answer one thing, answer this.

- **perfect_fit_companies** — 5 real company names you would *love* to land. These become the pre-flight test: we enrich each, extract their actual Crustdata attributes, and verify your filter query would have returned them.
- **bad_fit_companies** — 5 real companies that look similar but are *not* fits. These are negative examples — if they show up in results, the filter is too broad.
- **already_closed_customers** — companies you've already won, if any. Best possible signal.

## Section 4 — Ideal contact (person)

### 4.1 Buyer, champion, user — all different
- **buyer_titles** — who signs the contract (exact or near-exact titles)
- **champion_titles** — who advocates internally but isn't the decision maker
- **user_titles** — who uses the product day-to-day
- **primary_target** — which of the three you want to reach first

### 4.2 Seniority and function
- **seniority_levels** — C-suite / VP / Director / Manager / IC
- **functions** — Sales / Marketing / Ops / Product / Engineering / Finance / Legal / HR

### 4.3 Experience filters (optional)
- **min_years_in_role** — tenure signals
- **min_years_at_company**
- **recently_changed_jobs** — true if new-job triggers matter

### 4.4 Person disqualifiers
- **exclude_titles** — titles that look right but aren't (e.g., "VP of Engineering" when you want "VP of Sales")
- **exclude_seniority** — too junior, too senior

### 4.5 Ground truth (same as §3)
- **perfect_fit_people** — 3-5 real LinkedIn URLs that are ideal contacts
- **bad_fit_people** — 3-5 wrong-looking matches

## Section 5 — Intent / triggering signals (optional but high-leverage)

These are *not* filters — they're queries for `/web/search/live` that surface real-time buying signals. See `filter-strategy.md` §4.

- **pain_phrases** — what would a frustrated buyer say? ("switching from X", "looking for alternatives to Y", "struggling with Z")
- **trigger_events** — funding, exec change, product launch, layoffs, expansion
- **competitor_names** — companies your prospects might be abandoning
- **hiring_signals** — roles whose posting implies budget for your product

---

## What Crustdata **cannot** do directly (known gaps)

Answer these anyway — we handle them with workarounds:

- **B2B vs B2C filter**: doesn't exist. Inferred via industry + post-filter on description.
- **Specific vertical (e.g., "legal tech" vs "law firm")**: `INDUSTRY` uses LinkedIn's taxonomy, which is coarse. We combine INDUSTRY + TECHNOLOGIES_USED + post-enrichment filtering.
- **Funding stage (Seed / Series A / B+)**: no direct filter. Proxied via headcount range + ANNUAL_REVENUE + IN_THE_NEWS.
- **Website content / product type**: not in the dataset. Must enrich each company and read the description, or use `/web/search/live`.
