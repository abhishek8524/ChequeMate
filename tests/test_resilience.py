import json
import unittest
from decimal import Decimal as D
from unittest.mock import MagicMock, patch
from urllib.error import URLError

from fastapi.testclient import TestClient

from backend import database, explanations, resilience
from backend.main import Assumptions, HistoryMonth, Metrics, app


METRICS = dict(account_id=1, I=1000, S=800, F=400, H=200, B=1500, P=100)


def history(count=12):
    return [dict(month=f"2025-{i:02d}-01", money_in=1000, money_out=800,
                 avg_daily_balance=1500, days_below_zero=0) for i in range(1, count + 1)]


class TestResilience(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.account = patch("backend.database.fetch_account", return_value=METRICS).start()
        self.history = patch("backend.database.fetch_history", return_value=history()).start()
        self.addCleanup(patch.stopall)

    def post(self, path, **kwargs):
        response = self.client.post(path, json={"account_id": 1, **kwargs})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_score_components_and_history(self):
        response = self.client.get("/api/accounts/1/insights")
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        # 20 shock + 20 cashflow + 20 stability + 20 stress + 18 debt.
        self.assertEqual(D(data["score"]["score"]), 98)
        self.assertEqual(len(data["insights"]["history"]), 12)
        self.assertEqual(data["insights"]["recovery"], "unchanged")
        self.assertIsNone(data["insights"]["expense_visibility"]["cash_withdrawal_share"])

    def test_missing_history_is_not_full_score(self):
        self.history.return_value = []
        data = self.client.get("/api/accounts/1/insights").json()["score"]
        self.assertIsNone(data["score"])
        self.assertEqual(data["available_maximum"], 60)

    def test_bad_history_rejected(self):
        for rows in ([history()[0], history()[0]], history()[::2],
                     [{**history()[1], "days_below_zero": 29}],
                     [{**history()[0], "money_in": "NaN"}]):
            self.history.return_value = rows
            self.assertEqual(self.client.get("/api/accounts/1/insights").status_code, 503)

    def test_timing_trap_recovery_and_creep(self):
        rows = history()
        rows[6]["days_below_zero"] = 3
        rows[8]["days_below_zero"] = 1
        for row in rows[6:]:
            row["money_out"] = 900
        self.history.return_value = rows
        data = self.client.get("/api/accounts/1/insights").json()["insights"]
        self.assertEqual(len(data["timing_trap_months"]), 2)
        self.assertEqual(data["recovery"], "improving")
        self.assertTrue(data["cashflow_creep"]["outflow_growth_exceeds_inflow_growth"])

    def test_planner_target_and_cent_ceiling(self):
        self.account.return_value = {**METRICS, "B": "1499.999"}
        data = self.post("/api/plan", income_retained_pct=55, target_months=6)
        self.assertEqual(D(data["additional_savings_needed"]), D("0.01"))
        self.assertEqual(data["with_target_savings"]["runway_months"], 6)

    def test_planner_exhausted_buffer_no_shortfall(self):
        self.account.return_value = {**METRICS, "B": -10}
        data = self.post("/api/plan")
        self.assertEqual(D(data["additional_savings_needed"]), D("10.01"))
        self.assertEqual(data["with_target_savings"]["status"], "no_shortfall")

    def test_support_ends_at_six_months(self):
        self.account.return_value = {**METRICS, "B": 3000}
        data = self.post("/api/simulate/support", post_support_income_retained_pct=0)
        # 6 * 250 used during support; remaining 1500 / 800 = 1.875 months.
        self.assertEqual(D(data["runway_months"]), D("7.9"))
        self.assertEqual(D(data["projection"][6]["income"]), 0)

    def test_support_surplus_accumulates_and_recovery(self):
        data = self.post("/api/simulate/support", income_retained_pct=100,
                         post_support_income_retained_pct=0)
        self.assertEqual(D(data["runway_months"]), D("9.4"))
        data = self.post("/api/simulate/support", post_support_income_retained_pct=100)
        # Exhaustion at end of month six precedes recovery.
        self.assertEqual(D(data["runway_months"]), 6)
        self.account.return_value = {**METRICS, "B": 1600}
        data = self.post("/api/simulate/support", post_support_income_retained_pct=100)
        self.assertEqual(data["status"], "horizon_reached")

    def test_support_exhausted_precedence(self):
        self.account.return_value = {**METRICS, "B": 0}
        data = self.post("/api/simulate/support", post_support_income_retained_pct=100)
        self.assertEqual(D(data["runway_months"]), 0)
        self.assertEqual(data["projection"], [])

    def test_new_request_validation(self):
        for path, data in [("/api/plan", {"target_months": 121}),
                           ("/api/plan", {"target_months": 0}),
                           ("/api/simulate/support", {}),
                           ("/api/simulate/support", {"post_support_income_retained_pct": 101}),
                           ("/api/simulate/support", {"post_support_income_retained_pct": 0, "support_months": True})]:
            self.assertEqual(self.client.post(path, json={"account_id": 1, **data}).status_code, 422)
        self.account.assert_not_called()

    def test_quest_improvement_and_cards(self):
        data = self.post("/api/quest", extra_savings=1000)
        self.assertEqual(len(data["decision_cards"]), 3)
        self.assertGreaterEqual(D(data["score_change"]), 0)
        self.assertFalse(data["progress_persisted"])
        self.assertEqual(data["baseline_score"]["components"]["income_stability"],
                         data["simulated_score"]["components"]["income_stability"])

    def test_invalid_reduction_all_extensions(self):
        for path in ("/api/plan", "/api/quest", "/api/explain", "/api/simulate/support"):
            data = {"account_id": 1, "monthly_outflow_reduction": 801}
            if path.endswith("support"):
                data["post_support_income_retained_pct"] = 0
            self.assertEqual(self.client.post(path, json=data).status_code, 422)

    def test_breakdown_uses_unrounded_metrics(self):
        data = self.post("/api/simulate", income_retained_pct="55.123456789")
        self.assertEqual(D(data["calculation_breakdown"]["income_after_exact"]), D("551.23456789"))

    def test_history_failure_is_sanitized(self):
        self.history.side_effect = database.DatabaseUnavailable("secret")
        response = self.client.get("/api/accounts/1/insights")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret", response.text)

    def test_wrong_account_is_not_returned(self):
        self.account.return_value = {**METRICS, "account_id": 2}
        self.assertEqual(self.client.get("/api/accounts/1").status_code, 503)

    @patch.dict("os.environ", {}, clear=True)
    def test_explanation_endpoint(self):
        data = self.post("/api/explain", income_retained_pct=55)
        self.assertEqual(data["financial_result"]["runway_months"], 6)
        self.assertEqual(data["source"], "deterministic_fallback")

    @patch("backend.database.fetch_lookalikes")
    def test_lookalikes(self, fetch):
        fetch.return_value = [{**METRICS, "account_id": 2, "distance": D("0.1")}]
        response = self.client.get("/api/accounts/1/lookalikes")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["peers"][0]["income_shock"]["runway_months"], 6)

    @patch("backend.database.fetch_profile")
    def test_profile(self, fetch):
        fetch.return_value = {"region": "example"}
        self.assertEqual(self.client.get("/api/accounts/1/profile").json()["profile"], fetch.return_value)
        fetch.return_value = None
        self.assertEqual(self.client.get("/api/accounts/1/profile").status_code, 404)

    def test_score_bounds(self):
        h = resilience.history_insights([HistoryMonth.model_validate(r) for r in history()])
        for income, spending, buffer, debt in [(0, 0, 0, 0), (0, 100, -1, 200), (100, 10000, 1, 500)]:
            m = Metrics(**{**METRICS, "I": income, "S": spending, "B": buffer, "P": debt})
            result = resilience.score(m, h)
            self.assertGreaterEqual(result["score"], 0)
            self.assertLessEqual(result["score"], 100)


class TestExplanations(unittest.TestCase):
    def setUp(self):
        self.result = resilience.run(Metrics(**METRICS), Assumptions(income_retained_pct=55))

    @patch.dict("os.environ", {}, clear=True)
    def test_fallback(self):
        data = explanations.explain(self.result)
        self.assertEqual(data["source"], "deterministic_fallback")
        self.assertEqual(data["financial_result"], self.result)

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test", "GEMINI_MODEL": "test-model"})
    @patch("backend.explanations.urlopen")
    def test_valid_order_and_invalid_output(self, urlopen):
        ids = ["limits", "actions", "buffer", "cashflow", "outcome"]
        def reply(value):
            return json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(value)}]}}]}).encode()
        urlopen.return_value.__enter__.return_value.read.return_value = reply({"card_ids": ids})
        data = explanations.explain(self.result)
        self.assertEqual(data["source"], "gemini_ordered_verified_cards")
        self.assertEqual(data["cards"][0]["id"], "limits")
        for value in ({"card_ids": ["invented"]}, {"card_ids": ids, "runway": 999},
                      {"card_ids": ids[:-1] + ["limits"]}, {"card_ids": [None]}):
            urlopen.return_value.__enter__.return_value.read.return_value = reply(value)
            self.assertEqual(explanations.explain(self.result)["source"], "deterministic_fallback")
        urlopen.side_effect = URLError("private details")
        self.assertEqual(explanations.explain(self.result)["source"], "deterministic_fallback")


class TestExtendedDatabase(unittest.TestCase):
    @patch("backend.database.connect")
    def test_parameterization_and_cleanup(self, connect):
        for function, args in [(database.fetch_history, (123,)), (database.fetch_profile, (123,)),
                               (database.fetch_lookalikes, (123, D(1000), D(2000)))]:
            connect.reset_mock()
            function(*args)
            connection = connect.return_value.__enter__.return_value
            sql, values = connection.execute.call_args.args
            self.assertIn("%s", sql)
            self.assertEqual(values[-1], 123)
            self.assertNotIn("123", sql)
            connect.return_value.__exit__.assert_called_once()
