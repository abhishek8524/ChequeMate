"""Read-only live Gold verification: python -m backend.smoke.

Never prints connection URLs, raw database exceptions or account records.
"""

import json

import psycopg

from backend import database
from backend.main import Assumptions, HistoryMonth, Metrics
from backend.resilience import run


def main():
    try:
        with database.connect() as connection:
            rows = connection.execute(
                'SELECT account_id, "I", "S", "F", "H", "B", "P" FROM public.gold_account_metrics'
            ).fetchall()
            metrics = [Metrics.model_validate(row) for row in rows]
            ids = {m.account_id for m in metrics}
            if len(ids) != len(metrics) or len(metrics) != 4500:
                raise ValueError("Gold population count or uniqueness mismatch")
            for m in metrics:
                for assumptions in (Assumptions(income_retained_pct=55),
                                    Assumptions(income_retained_pct=55, bills_increase_pct=15),
                                    Assumptions(income_retained_pct=55, one_off_cost=m.S)):
                    run(m, assumptions)
            for account_id in (28754, 35412):
                m = next((m for m in metrics if m.account_id == account_id), None)
                if m is None:
                    raise ValueError("Verified example missing")
                expected = 4.7 if account_id == 28754 else 41.3
                if run(m, Assumptions(income_retained_pct=55))["runway_months"] != expected:
                    raise ValueError("Verified example differs from Gold")
                history = database.fetch_history(account_id)
                if not history or database.fetch_profile(account_id) is None:
                    raise ValueError("Gold profile or history missing")
                for row in history:
                    HistoryMonth.model_validate(row)
        print(json.dumps({"status": "ok", "accounts_validated": len(metrics),
                          "scenarios_validated": len(metrics) * 3, "sample_profiles_and_history": 2}))
        return 0
    except (database.DatabaseUnavailable, psycopg.Error):
        print(json.dumps({"status": "blocked", "reason": "Database not configured or unavailable; check private local settings."}))
        return 1
    except (ValueError, ArithmeticError):
        print(json.dumps({"status": "failed", "reason": "Gold data or scenario validation failed; investigate privately."}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
