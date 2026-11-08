# ChequeMate API

See [HANDOFF.md](HANDOFF.md) for the score methodology, insights, temporary support,
planner, quests, Gemini boundary, new endpoints and remaining live checks.

Run from the repository root with Python 3.10+:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
# Edit .env locally with your TigerData connection URL and browser origins.
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

If `.venv` or `.env` already exists, reuse it instead of recreating or overwriting it.
Production needs only `requirements.txt`. Environment variables override the root
`.env`. `.env` stays ignored; `.env.example` contains placeholders only. Use the
TigerData-provided SSL connection URL and a role with SELECT permission on
`public.gold_account_metrics`. The adapter requests read-only transactions and
uses ten-second connection and statement timeouts. It opens and closes a
connection per request; it does not migrate or write database tables.

Interactive API documentation: http://127.0.0.1:8001/docs

## Contract

- `GET /api/health`: database connectivity readiness, 200 or 503. This checks
  `SELECT 1`, not table readiness.
- `GET /api/accounts/28754`: `account_id`, `I`, `S`, `F`, `H`, `B`, `P` from Gold.
- `POST /api/simulate`: account ID plus scenario assumptions; metrics cannot be
  supplied or overridden in the request.

```json
{
  "account_id": 28754,
  "income_retained_pct": 55,
  "bills_increase_pct": 15,
  "one_off_cost": "13008.715"
}
```

Income retention defaults to 100 (range 0–100); bills increase and one-off cost
default to zero and must be nonnegative. Separate and combined shocks use the
same request. Optional nonnegative `monthly_outflow_reduction`,
`extra_monthly_cost`, and `extra_savings` reuse existing calculator features.
Unknown fields, nonfinite values, invalid IDs and impossible outflow reductions
return 422. Missing accounts return 404; unavailable database configuration,
database failures and incomplete/invalid Gold metrics return 503 without exposing
connection details.

Responses contain `original_metrics`, `scenario_assumptions`,
`income_after_shock`, `spending_after_shock`, `buffer_left`, `monthly_shortfall`,
`runway_months`, `runway_display`, and `status`. Metrics and assumptions serialize
as decimal strings to preserve source precision; calculator output uses its
existing numeric JSON representation. No input metrics are rounded before
calculation. `F` and `P` are returned for context; they are already represented
in spending and must not be added again.

The unchanged `backend.simulator.calculate_runway` computes:

```text
income_after = I * income_retained_pct / 100
spending_after = S + H * bills_increase_pct / 100 + extra_monthly_cost - monthly_outflow_reduction
buffer_left = B + extra_savings - one_off_cost
gap = spending_after - income_after
```

Exhausted buffer takes precedence (0 months); no shortfall returns 120 months
with status `no_shortfall`; positive shortfall runway is capped at 120 months.
Runway rounds half-up to one decimal, cash amounts to two, after calculation.
The API uses the existing tested Tangerine implementation, including the 55%
income-retention and 15% bill-increase cases. The original official judging
document was unavailable for independent comparison during this integration.

## Frontend connection and migration

`core-app/` and `data-engineering/` are unchanged; the offline demo still runs.
Serve the frontend separately on port 8000 and configure `CORS_ORIGINS` with its
exact origin. Restart the API after changing origins. A future frontend change
can use:

```javascript
const response = await fetch('http://127.0.0.1:8001/api/simulate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account_id: 28754, income_retained_pct: 55,
                         bills_increase_pct: 15, one_off_cost: 0 })
});
if (!response.ok) throw new Error(`Simulation failed: ${response.status}`);
const result = await response.json();
// Render result.runway_display, result.monthly_shortfall and result.buffer_left.
```

Migrate every runway consumer (customer cards, shock lab, plans, stress grid,
coach and population insights) to Python results before retiring local formulas.
Do not recalculate runway in JavaScript. Map existing `inc` directly to
`income_retained_pct`, `bills` to `bills_increase_pct`, and resolve `oneMult * S`
as a one-off assumption. Existing negative bill-change controls need a separate
approved API contract; this endpoint supports bill increases. EI duration and
income recovery in the projection chart are separate from the judging runway.
The six-metric endpoint does not replace monthly-history or profile data.

Current duplication: `app.js` computes runway locally and represents no
shortfall as Infinity; `build_data.py` computes metrics from CSVs, rounds exported
metrics to two decimals, and uses an unrounded NumPy runway for population
statistics. Gold is the validated source for the new API. Future population
builds should consume Gold and the Python engine to avoid precision drift.

Gemini may explain validated API output but may never invent or modify financial
numbers. This backend does not call Gemini. The current frontend coach remains
unchanged; applying this boundary there requires the future frontend migration.

## Verification and repository context

```powershell
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

API tests mock database access; adapter tests mock psycopg connections. No real
TigerData connection or credentials are needed. A real database smoke test must
be performed separately with configured credentials. This API has no account
authentication; keep it local until access control is added for shared hosting.

Entire Graph located `calculate_runway`, its callers/tests and duplicate frontend
formulas. Graph reported partial coverage for generated bundles and SQL, so the
relevant SQL and frontend source were also inspected directly. Brain retrieved
the prior simulator review, but recall found no durable architecture memories.
The five user-approved decisions were stored with `entire brain remember` under
`architecture.financial.decisions` (decision `fact:a4681cb38e69ba430e7d7b32`).

Implementation follows the official [psycopg parameter binding documentation](https://www.psycopg.org/psycopg3/docs/basic/params.html)
and [FastAPI testing documentation](https://fastapi.tiangolo.com/tutorial/testing/).
