# Crustdata Filter Reference

Empirically confirmed (from 400-error responses and successful calls). Update this file as we learn more.

> **Learned from error responses — these catch real gotchas.** Every time the API returns 400, record the message here before fixing the code, so the next person doesn't relearn it.

## Scope — which filters work where

Company search (`POST /screener/company/search`) accepts **only** these types:

```
COMPANY_HEADCOUNT, REGION, INDUSTRY, NUM_OF_FOLLOWERS,
DEPARTMENT_HEADCOUNT_GROWTH, FORTUNE, TECHNOLOGIES_USED,
COMPANY_HEADCOUNT_GROWTH, ANNUAL_REVENUE, DEPARTMENT_HEADCOUNT,
ACCOUNT_ACTIVITIES, JOB_OPPORTUNITIES
```

**Notably NOT valid for company search:** `COMPANY_TYPE`, `COMPANY_HEADQUARTERS`, `IN_THE_NEWS`, `CURRENT_TITLE`, all person filters. These are **people-search filters**. This split isn't obvious from the docs — confirmed via 400 response. 

## Endpoints

| Intent | Method & path |
|---|---|
| **Search** companies by filters | `POST /screener/company/search` |
| **Search** people by filters | `POST /screener/person/search` (and `/screen/` variant) |
| **Enrich** one company | `GET /screener/company?company_domain=...` |
| **Enrich** one person | `GET /screener/person/enrich?linkedin_profile_url=...&enrich_realtime=true` |
| **Live web search** | `POST /screener/web-search` with `{"query": "..."}` |

Auth: `Authorization: Token <key>`.

## Valid filter types (from the API's own error message)

```
CURRENT_COMPANY          CURRENT_TITLE         PAST_TITLE          PAST_COMPANY
SCHOOL                   FIRST_NAME            LAST_NAME           FUNCTION
SENIORITY_LEVEL          PROFILE_LANGUAGE
YEARS_AT_CURRENT_COMPANY YEARS_IN_CURRENT_POSITION  YEARS_OF_EXPERIENCE
RECENTLY_CHANGED_JOBS    POSTED_ON_LINKEDIN    NUM_OF_FOLLOWERS

COMPANY_HEADQUARTERS     COMPANY_HEADCOUNT     REGION              INDUSTRY
COMPANY_TYPE             FORTUNE               TECHNOLOGIES_USED
ANNUAL_REVENUE           COMPANY_HEADCOUNT_GROWTH
DEPARTMENT_HEADCOUNT     DEPARTMENT_HEADCOUNT_GROWTH
IN_THE_NEWS              ACCOUNT_ACTIVITIES    JOB_OPPORTUNITIES
```

**Notable absences:** no `COMPANY_NAME`, no `SKILLS`, no direct `FUNDING_STAGE`, no `B2B_OR_B2C`, no `WEBSITE_URL` filter.

## Filter object shape

```json
{ "filter_type": "INDUSTRY", "type": "in", "value": ["Software"] }
```

The `type` operator appears to support: `in`, and for numeric filters likely `between` / `gte` / `lte`. Exact set to be confirmed empirically.

## Filter-by-filter notes

Values marked **empirical** are the ones we've seen work or fail in live calls. Values marked **inferred** are based on LinkedIn Sales Navigator conventions (which Crustdata mirrors) but not yet confirmed here.

### COMPANY_HEADCOUNT (confirmed — note the **commas**)
```
"Self-employed", "1-10", "11-50", "51-200", "201-500",
"501-1,000", "1,001-5,000", "5,001-10,000", "10,001+"
```
⚠️ Comma formatting matters. `"501-1000"` returns 400.

### INDUSTRY (strict enum — *not* arbitrary LinkedIn strings)
⚠️ `"Computer Software"` returned 400. Crustdata uses a specific internal industry list — NOT LinkedIn's raw industry strings.

**Valid values observed from live search output** (seed set — grow as we learn more):

```
Software Development                       (umbrella for B2B SaaS — very broad)
IT Services and IT Consulting
Technology, Information and Internet
Technology, Information and Media
Online Audio and Video Media
Online Media
E-Learning Providers
Financial Services
Venture Capital and Private Equity Principals
Computer and Network Security
Advertising Services
Human Resources Services
Staffing and Recruiting
Retail Apparel and Fashion
Book and Periodical Publishing
Aviation and Aerospace Component Manufacturing
Non-profit Organizations
Hospitality
```

**Known noise**: TechCrunch and Sequoia Capital both show up as `"Software Development"`. The industry field is miscategorized frequently. Use INDUSTRY as a coarse funnel, then post-filter on description/tech-stack for vertical specificity.

**Discovery recipe**: run `/screener/company/search` with only `COMPANY_HEADCOUNT` set and inspect the `industry` strings that come back. Those are always valid.

Docs link for the full canonical list: `https://fulldocs.crustdata.com/docs/discover/company-apis/how-to-build-company-filters` (auth-gated).

### REGION / COMPANY_HEADQUARTERS (inferred)
Countries, sometimes states/metros. Examples: `"United States"`, `"United Kingdom"`, `"Canada"`, `"San Francisco Bay Area"`.

### TECHNOLOGIES_USED (high-leverage — may be plan-gated)
⚠️ Our token saw: `"No mapping found for TECHNOLOGIES_USED: Salesforce. Correct values are []"`. This means either (a) our plan tier doesn't expose the tech-stack dataset, or (b) values must match a specific canonical form we haven't learned yet. **Verify on the billing page / with Crustdata support before relying on this filter.** Likely tool names: `"Salesforce"`, `"HubSpot"`, `"Snowflake"`, etc.

### ANNUAL_REVENUE (inferred ranges)
Typically enum: `"$1M-$10M"`, `"$10M-$50M"`, `"$50M-$100M"`, `"$100M-$500M"`, `"$500M+"`. Confirm via a test call.

### COMPANY_HEADCOUNT_GROWTH (numeric with window)
Growth over a period. Likely accepts `{ "type": "between", "value": {"min": 10, "max": 100}, "time_period": "last_6_months" }` or similar — confirm empirically.

### COMPANY_TYPE
`"Private"`, `"Public"`, `"Nonprofit"`, `"Educational"`, `"Government"`, `"Partnership"`, `"Self-Employed"`.

### SENIORITY_LEVEL (inferred)
`"Owner"`, `"Founder"`, `"C-Suite"`, `"Partner"`, `"VP"`, `"Director"`, `"Manager"`, `"Senior"`, `"Entry"`.

### FUNCTION (inferred)
`"Sales"`, `"Marketing"`, `"Operations"`, `"Product Management"`, `"Engineering"`, `"Finance"`, `"Human Resources"`, `"Information Technology"`, `"Business Development"`, `"Legal"`.

### CURRENT_TITLE / PAST_TITLE
Free-text keyword match. Multiple values in `value` list are OR'd.

### IN_THE_NEWS
Enumerated recent-news topics (e.g., `"Funding"`, `"Leadership change"`, `"Layoffs"`). Confirm values empirically.

### JOB_OPPORTUNITIES
Signals open roles. Supports type like `"hiring for [function]"` — confirm payload shape.

### ACCOUNT_ACTIVITIES
Recent company activity signals (hiring, content publishing, leadership changes). Confirm payload shape.

### YEARS_* filters
Numeric ranges. Likely `{"type": "between", "value": {"min": 2, "max": 10}}`.

---

## How to discover unknown enum values

Send a filter with a bogus value and the API will reject it, often with the valid enum list. Example:

```bash
curl -sS -X POST https://api.crustdata.com/screener/company/search \
  -H "Authorization: Token $KEY" -H "Content-Type: application/json" \
  -d '{"filters":[{"filter_type":"COMPANY_HEADCOUNT","type":"in","value":["BOGUS"]}],"page":1}'
```

This is how we discovered the full list of valid `filter_type` values. Cost: usually 0 credits for rejected queries (confirm on the billing page).
