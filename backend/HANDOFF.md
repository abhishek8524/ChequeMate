# Backend handoff and review

## Implemented

The original Decimal simulator is unchanged. Gold metrics remain authoritative;
F and P are context already represented in S, not additional expenses.
No files under `core-app/` or `data-engineering/` were changed.

| Endpoint | Purpose |
|---|---|
| GET `/api/health` | Database connectivity, not table readiness |
| GET `/api/accounts/{id}` | Validated six Gold metrics |
| GET `/api/accounts/{id}/profile` | Gold account context, no inferred outstanding debt |
| GET `/api/accounts/{id}/insights` | Score, history, timing traps, recovery, cashflow creep |
| GET `/api/accounts/{id}/lookalikes` | Five nearest other accounts in inflow/buffer space, with reference shock |
| POST `/api/simulate` | Constant shock plus exact calculation breakdown |
| POST `/api/simulate/support` | Temporary retained income, then explicit post-support assumption |
| POST `/api/plan` | Savings target and break-even tipping points |
| POST `/api/quest` | Baseline/scenario scores, alternative decision cards, educational missions |
| POST `/api/explain` | Verified explanation cards, optionally ordered by Gemini |

All POSTs take `account_id` and the existing optional scenario assumptions.
Extra request fields are rejected. Metrics cannot be supplied by callers.
Validation errors are 422, absent records 404, unavailable or invalid Gold data 503.
Database error details and credentials are not returned.

Exact Decimal values in the new responses are **JSON strings**. Existing simulator
display outputs remain JSON numbers. Render returned results; do not recompute
financial outputs in the browser. Full request schemas are at `/docs` and `/openapi.json`.

## Examples

Combined shock, including furnace repair equal to the selected account's S:

```json
{"account_id":28754,"income_retained_pct":55,"bills_increase_pct":15,"one_off_cost":"13008.715"}
```

POST `/api/plan` or `/api/quest`:

```json
{"account_id":28754,"income_retained_pct":55,"target_months":6,"extra_savings":0,"monthly_outflow_reduction":0}
```

The planner returns `additional_savings_needed`, rounded **up** to a cent,
`required_buffer`, `current`, and `with_target_savings`. It uses unrounded gaps.
It requires a positive buffer of at least a cent even for no-shortfall scenarios,
preserving the simulator's exhausted-buffer precedence. Targets are 0 < months <= 120.
Break-even retained income can exceed 100%; this indicates that original income
alone cannot cover simulated outflows. Zero original income returns null.

POST `/api/simulate/support`:

```json
{"account_id":28754,"income_retained_pct":55,"support_months":6,"post_support_income_retained_pct":0}
```

The post-support percentage is required; it is never silently assumed. The
projection accumulates surpluses and deducts deficits. Fractional exhaustion is
calculated within the month; projection ends at exhaustion or 120 months. The
last exhaustion month's end balance may be negative. `horizon_reached` describes
only the horizon, not permanent sustainability. This is hypothetical support,
not an assertion about EI eligibility. One-off costs apply at the start only.

For a synthetic I=1000, S=800, B=3000 account, six months at 55% followed by zero
income consumes 1500 during support and lasts another 1.875 months: display 7.9.

## Experimental score v1

This is an educational indicator, **not a credit score or complete financial
health assessment**. The following product choices are transparent heuristics,
not empirically calibrated risk thresholds. Five components each contribute 0–20:

| Component | Formula (clamp means restrict to 0–1) |
|---|---|
| Shock resilience | 20 × clamp(exact 55%-income shock runway / 6) |
| Cashflow health | 20 × clamp((I − S) / I / 0.20) |
| Income stability | 20 × clamp(1 − population income standard deviation / mean income) |
| Recent balance stress | 20 × (1 − fraction of latest six months with negative-balance days) |
| Recorded debt commitments | 20 × clamp(1 − P / I) |

Exhausted buffer earns zero shock points; positive buffer with no gap earns full
shock points. Zero income earns zero cashflow points and zero debt points unless
P is zero, which earns full debt points. Income stability needs a positive mean
and at least six months; recent stress needs six months. Missing components yield
`score: null` with `available_points` and `available_maximum`; we do not normalize
partial coverage to 100. Final points are rounded to two decimals. The exact
runway, rather than its rounded display, determines shock points.

Scenario scores apply the same formula to hypothetical income, outflows and
buffer. The reference shock retains 55% of that scenario income, so this is a
stress test of the hypothetical state. Historical components and recorded P stay
unchanged. A simulation does not rewrite historical facts or settle debt.

## Insights and quests

History must have unique, consecutive calendar months and valid daily counts.
Invalid or gapped records return 503; no history produces an explicitly incomplete
score. Timing traps mean nonnegative monthly inflow minus outflow together with
negative-balance days. Recovery compares negative days in the latest three months
with the preceding three; it does not claim a cause or guarantee future recovery.
Cashflow creep compares medians in the earliest/latest six months (at least twelve
required). It cannot identify unnecessary spending.

Expense visibility is unavailable from the monthly table; the population's
reported cash-withdrawal share is not imputed to any account. Lookalikes rank
`abs(I-peer_I)/max(abs(I),1) + abs(B-peer_B)/max(abs(B),1)`; the nearest five may
still be dissimilar. These are descriptive comparisons, not causal matches.

Quest decision cards compare target savings, a hypothetical 10% outflow reduction,
and restoration of original income. Missions reflect timing and income variability.
No real-world mission completion, persistent progress, XP or badges are claimed.
Those optional features require a user/progress store and are not implemented.

## Gemini boundary

Set private `GEMINI_API_KEY` and `GEMINI_MODEL` to enable optional card ordering.
The model receives approved cards without account identifiers and returns only
card IDs. The server checks that every known ID appears exactly once, rejects
extra fields, and renders all text itself. Unknown IDs, malformed output, missing
configuration and provider errors use the deterministic fallback. Numeric results
are never model-generated. This deliberately constrained explanation integration
can be handed to the teammate for richer, separately validated prose later.

Provider REST fields follow the official
[Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output?lang=rest).
Live model compatibility remains unverified until a project/model is configured.

## Verification and remaining integration

```powershell
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
.venv/Scripts/python.exe -m pytest -q
# Copy .env.example to .env only if .env does not already exist; edit privately.
.venv/Scripts/python.exe -m backend.smoke
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

The live smoke check reads all Gold metrics, requires 4500 unique accounts,
validates three shocks per account, checks the two verified sample runways, and
checks sample profiles/history. It never prints credentials or raw database errors.
It does not certify every profile/history row or benchmark production traffic.

Current local verification: tests use mocked database/provider responses. No
`DATABASE_URL` or `GEMINI_API_KEY` is configured, so live verification is blocked.
Do not describe all 4500 live lookups or Gemini calls as verified yet.
The local Uvicorn HTTP check returned 200 for `/docs` and `/openapi.json`, with
all ten API paths present. The test suite now contains 53 passing tests.

Frontend teammate: consume these endpoints for every runway display before
retiring local formulas. Existing `app.js` no-shortfall Infinity and rounded
`build_data.py` exports differ from the Python API contract. Frontend migration,
actual browser CORS checks, and account authorization remain separate integration
work. Keep the API local until access control is implemented.

## Entire review evidence

Brain brief/recall recovered the authoritative-Gold/Python-calculation decisions;
Graph located simulator/API consumers and duplicate frontend formulas. Generated
frontend bundles and SQL have partial Graph coverage, so relevant Gold SQL was
inspected directly. Brain's seed was stale; current source and executed tests
were used to establish behavior. Existing API commit 78e8f41 is linked to
checkpoint 01M6X6GZD4MTQVYSVPVW15B6AR.

`entire trail list --project gh/abhishek8524` failed because the project does not
exist or is not visible to the current login. A hosted Trail review has **not**
been completed. The owner must connect the repository/project in Entire or sign
in with an account that can access it before creating a Trail and requesting review.
No token-saving claims were made.
