import unittest
from decimal import Decimal
from unittest.mock import patch

import psycopg
from fastapi.testclient import TestClient

from backend.main import app


METRICS = dict(account_id=28754, I=Decimal("14148.22"), S=Decimal("13008.715"),
               F=Decimal("4000"), H=Decimal("2963.86"), B=Decimal("24342.62"), P=Decimal("300"))


class TestAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.fetch = patch("backend.database.fetch_account", return_value=METRICS).start()
        self.addCleanup(patch.stopall)

    def test_account_preserves_gold_precision(self):
        response = self.client.get("/api/accounts/28754")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["S"], "13008.715")
        self.assertEqual(set(response.json()), set(METRICS))
        self.fetch.assert_called_once_with(28754)

    def test_scenarios(self):
        cases = [({"income_retained_pct": 55}, 4.7),
                 ({"income_retained_pct": 55, "bills_increase_pct": 15}, 4.3),
                 ({"income_retained_pct": 55, "one_off_cost": "13008.715"}, 2.2),
                 ({"bills_increase_pct": 15}, 120),
                 ({"one_off_cost": 25000}, 0)]
        for assumptions, expected in cases:
            with self.subTest(assumptions=assumptions):
                response = self.client.post("/api/simulate", json={"account_id": 28754, **assumptions})
                self.assertEqual(response.status_code, 200, response.text)
                result = response.json()
                self.assertEqual(result["runway_months"], expected)
                self.assertEqual(result["original_metrics"]["S"], "13008.715")
                self.assertIn("monthly_shortfall", result)
                self.assertIn("buffer_left", result)
                self.assertIn("status", result)
                self.assertIn("scenario_assumptions", result)

    def test_combined_shock_cashflow(self):
        self.fetch.return_value = dict(account_id=1, I=1000, S=2000, F=500, H=400, B=6000, P=0)
        result = self.client.post("/api/simulate", json={"account_id": 1,
            "income_retained_pct": 55, "bills_increase_pct": 15, "one_off_cost": 500}).json()
        self.assertEqual(result["monthly_shortfall"], 1510)
        self.assertEqual(result["buffer_left"], 5500)
        self.assertEqual(result["runway_months"], 3.6)

    def test_gold_average_retains_long_fraction(self):
        self.fetch.return_value = {**METRICS, "B": Decimal("24342.62666666667")}
        result = self.client.post("/api/simulate", json={"account_id": 28754,
            "income_retained_pct": 55})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["original_metrics"]["B"], "24342.62666666667")
        self.assertEqual(result.json()["runway_months"], 4.7)

    def test_invalid_requests_rejected_before_database(self):
        for changes in ({"income_retained_pct": 101}, {"income_retained_pct": -1},
                        {"bills_increase_pct": -1}, {"one_off_cost": -1},
                        {"one_off_cost": "NaN"}, {"one_off_cost": "Infinity"},
                        {"one_off_cost": True}, {"one_off_cost": None},
                        {"account_id": True}, {"account_id": "28754"},
                        {"account_id": 0}, {"account_id": 2**63}, {"I": 5000}):
            with self.subTest(changes=changes):
                response = self.client.post("/api/simulate", json={"account_id": 28754, **changes})
                self.assertEqual(response.status_code, 422, response.text)
        self.fetch.assert_not_called()

    def test_missing_accounts(self):
        self.fetch.return_value = None
        self.assertEqual(self.client.get("/api/accounts/1").status_code, 404)
        self.assertEqual(self.client.post("/api/simulate", json={"account_id": 1}).status_code, 404)

    def test_invalid_path(self):
        for value in ("abc", "0", "-1", str(2**63)):
            self.assertEqual(self.client.get("/api/accounts/" + value).status_code, 422)
        self.fetch.assert_not_called()

    def test_database_failure_does_not_leak_credentials(self):
        self.fetch.side_effect = psycopg.OperationalError("secret-password")
        for response in (self.client.get("/api/accounts/1"),
                         self.client.post("/api/simulate", json={"account_id": 1})):
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("secret-password", response.text)

    def test_bad_gold_metrics(self):
        for value in (None, "NaN", -1):
            self.fetch.return_value = {**METRICS, "I": value}
            self.assertEqual(self.client.get("/api/accounts/28754").status_code, 503)

    def test_impossible_outflow_reduction(self):
        response = self.client.post("/api/simulate", json={"account_id": 28754,
            "monthly_outflow_reduction": 20000})
        self.assertEqual(response.status_code, 422)

    @patch("backend.database.check_health")
    def test_readiness(self, check):
        self.assertEqual(self.client.get("/api/health").json(), {"status": "ok", "database": "ok"})
        check.side_effect = psycopg.OperationalError("secret-password")
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret-password", response.text)


if __name__ == "__main__":
    unittest.main()
