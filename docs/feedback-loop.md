# Feedback Loop — Validating & Iterating a Filter Query

Bad queries are silent. You get a list of 50 companies that look roughly right and miss the 30% that shouldn't be there. This doc defines three checks that expose filter errors *before* you start outreach.

## 1. Pre-flight: ground-truth match test

**Runs before spending search credits.** Uses the `perfect_fit_companies` from the ICP.

```
for each perfect_fit company:
  enrich via GET /screener/company?company_domain=X
  extract: headcount, hq_country, industry, tech_stack, company_type
  test: does the proposed filter query match these attributes?
  if no → report the specific attribute that excludes this company
```

**Output**: a table like —

| Perfect-fit company | Would query include it? | Why not |
|---|---|---|
| LegalSoftwareCo | ✅ yes | — |
| SmallLawTech | ❌ no | headcount "11-50" not in your filter (you have "51-200"+) |
| GlobalLegalOps | ❌ no | HQ "Singapore" not in your REGION filter |

If >30% of perfect-fit companies are excluded, the filter is too narrow. Widen buckets (Rule 3 in filter-strategy.md).

## 2. Post-query: precision sample

**Runs on the first page of results** (top 10-20 companies).

For each:
- **Automatic disqualifier check** — does the result violate any `exclude_*` rule?
- **LLM fit-score (0/1)** — given the ICP description and the company's enriched profile, is this a genuine fit? A small prompt like:
  > *"ICP: {product_description}. Target: {ideal_customer_summary}. Candidate: {enriched_company_profile}. Is this a fit? Answer yes/no and give one-line reasoning."*

Compute **precision@10** — fraction labeled "yes". Target: **≥70%** to proceed with outreach at scale. Below 50% means iterate the filters before anything else.

## 3. Diagnosis — why are results bad?

When precision is low, categorize each miss into one of these buckets. Don't just say "results are bad" — say *which axis is wrong*.

| Failure type | Likely filter to change |
|---|---|
| Company is in the wrong industry | Tighten `INDUSTRY`, or add a `TECHNOLOGIES_USED` filter |
| Company is too small / too large | Adjust `COMPANY_HEADCOUNT` bucket |
| Company is in the wrong country | `REGION` or `COMPANY_HEADQUARTERS` |
| Company is B2C / wrong business model | Add a `TECHNOLOGIES_USED` proxy, or post-filter on description |
| Company is already a customer / competitor | Add to `exclude_companies` |
| Person has wrong title but right company | Tighten `CURRENT_TITLE` keywords |
| Person is too junior | Add `SENIORITY_LEVEL` or `YEARS_OF_EXPERIENCE` |
| Person left the company already | Enrich and post-filter on employment dates |

Report the **top failure category** with counts. Example:
> "7/10 misses are wrong-industry companies (law firms themselves, not legal-tech vendors). Add `TECHNOLOGIES_USED in ['Clio', 'MyCase']` or remove `INDUSTRY: Legal Services`."

## 4. Iteration loop

```
   [ICP spec]
      ↓
   [propose filters]  ← (rationale per filter, printed)
      ↓
   [pre-flight: ground-truth match]  ← fail fast if filters exclude known-good
      ↓
   [run search page=1, limit=10]
      ↓
   [precision sample]  ← auto-disqualifier + LLM fit-score
      ↓
   precision ≥ 70%? → [scale to full pull]
   precision < 70%? → [diagnose → revise filters → loop]
```

Every iteration should change **one axis at a time** — otherwise you can't tell which change moved the needle. Keep a log in `out/{icp_name}_iterations.md`:

```
Iteration 1: INDUSTRY=[Software], HEADCOUNT=[51-200]          → P@10 = 40%
  Diagnosis: 6/10 misses are non-B2B software
Iteration 2: +TECHNOLOGIES_USED=[Salesforce]                  → P@10 = 70%
  Diagnosis: remaining misses are wrong-size companies
Iteration 3: HEADCOUNT=[51-200, 201-500]                      → P@10 = 80%
  ✓ Proceed to scale
```

## 5. What "useful" means — three distinct quality axes

Don't collapse these into one "good/bad" score.

| Axis | What it measures | How to check |
|---|---|---|
| **Fit** | Is this the right company/person to contact? | Precision sample (§2) |
| **Contactability** | Do we have a reachable email + verified LinkedIn? | Field completeness on enriched record |
| **Signal freshness** | Is the profile current, not stale by 18 months? | `last_updated` field on enriched record |

A high-fit list with stale data or no emails is worthless for outreach. All three need to pass.

## 6. Automation vs. human-in-loop

- **Pre-flight ground-truth test**: fully automated. Runs every build.
- **Precision sample**: LLM-scored is a decent approximation; have a human spot-check the first batch per ICP to calibrate the LLM prompt.
- **Diagnosis**: LLM can categorize misses; the *action* (filter revision) should be human-approved in v1 to build intuition for the filter universe.

After ~3 ICPs you'll have enough filter intuition to let the loop run more autonomously.
