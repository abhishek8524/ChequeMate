
import unittest

from backend.simulator import calculate_runway


class TestSimulator(unittest.TestCase):

    def test_account_28754_job_loss(self):
        result = calculate_runway(
            14148.22, 13008.715, 24342.62, 2963.86,
            income_retained_pct=55
        )

        self.assertEqual(result["runway_months"], 4.7)

    def test_account_35412_job_loss(self):
        result = calculate_runway(
            2858.71, 1877.49, 12609.938, 1868.30,
            income_retained_pct=55
        )

        self.assertEqual(result["runway_months"], 41.3)

    def test_combined_shock(self):
        result = calculate_runway(
            14148.22, 13008.715, 24342.62, 2963.86,
            income_retained_pct=55,
            bills_increase_pct=15
        )

        self.assertEqual(result["runway_months"], 4.3)

    def test_furnace_and_job_loss(self):
        result = calculate_runway(
            14148.22, 13008.715, 24342.62, 2963.86,
            income_retained_pct=55,
            one_off_cost=13008.715
        )

        self.assertEqual(result["runway_months"], 2.2)

    def test_empty_buffer(self):
        result = calculate_runway(
            1000, 2000, -500
        )

        self.assertEqual(result["runway_months"], 0)
        self.assertEqual(result["status"], "buffer_exhausted")

    def test_no_shortfall(self):
        result = calculate_runway(
            5000, 2000, 2000
        )

        self.assertEqual(
            result["runway_display"],
            "No shortfall (120+)"
        )

    def test_invalid_percentage(self):
        with self.assertRaises(ValueError):
            calculate_runway(
                5000, 2000, 2000,
                income_retained_pct=105
            )

    def test_hypothetical_savings(self):
        original = calculate_runway(
            1000, 2000, 6000
        )

        improved = calculate_runway(
            1000, 2000, 6000,
            extra_savings=1000
        )

        self.assertGreater(
            improved["runway_months"],
            original["runway_months"]
        )


    def test_shock_components(self):
        result = calculate_runway(
            1000, 2000, 6000, bills=400,
            income_retained_pct=55, bills_increase_pct=15,
            one_off_cost=500,
        )
        self.assertEqual(result["income_after_shock"], 550)
        self.assertEqual(result["spending_after_shock"], 2060)
        self.assertEqual(result["buffer_left"], 5500)
        self.assertEqual(result["monthly_shortfall"], 1510)
        self.assertEqual(result["runway_months"], 3.6)

    def test_exhausted_buffer_takes_precedence(self):
        for spending in (500, 1000, 2000):
            for one_off in (500, 600):
                with self.subTest(spending=spending, one_off=one_off):
                    result = calculate_runway(
                        1000, spending, 500, one_off_cost=one_off,
                    )
                    self.assertEqual(result["buffer_left"], 500 - one_off)
                    self.assertEqual(result["runway_months"], 0)
                    self.assertEqual(result["runway_display"], "0.0 months")
                    self.assertEqual(result["status"], "buffer_exhausted")

    def test_break_even_and_surplus(self):
        for spending in (1000, 900):
            with self.subTest(spending=spending):
                result = calculate_runway(1000, spending, 500)
                self.assertEqual(result["runway_months"], 120)
                self.assertEqual(result["monthly_shortfall"], 0)
                self.assertEqual(result["status"], "no_shortfall")
                self.assertEqual(result["runway_display"], "No shortfall (120+)")

    def test_runway_cap_and_rounding(self):
        for buffer, expected, status in (
            (11994, 119.9, "shortfall"),
            (11995, 120.0, "shortfall"),
            (12000, 120.0, "capped"),
            (12100, 120.0, "capped"),
            (125, 1.3, "shortfall"),
        ):
            with self.subTest(buffer=buffer):
                result = calculate_runway(1000, 1100, buffer)
                self.assertEqual(result["runway_months"], expected)
                self.assertEqual(result["runway_display"], f"{expected:.1f} months")
                self.assertEqual(result["status"], status)

    def test_runway_uses_unrounded_cashflow(self):
        result = calculate_runway(0, "0.014", "1.001")
        self.assertEqual(result["monthly_shortfall"], 0.01)
        self.assertEqual(result["runway_months"], 71.5)

    def test_percentage_boundaries(self):
        for percentage, expected in ((0, 3.0), (100, 6.0)):
            with self.subTest(percentage=percentage):
                result = calculate_runway(
                    1000, 2000, 6000, income_retained_pct=percentage,
                )
                self.assertEqual(result["runway_months"], expected)
        with self.assertRaises(ValueError):
            calculate_runway(1000, 2000, 6000, income_retained_pct=-1)

    def test_negative_inputs(self):
        inputs = dict(
            inflow=1000, spending=2000, buffer=6000, bills=400,
            bills_increase_pct=15, one_off_cost=0,
            monthly_outflow_reduction=0, extra_monthly_cost=0, extra_savings=0,
        )
        for name in inputs.keys() - {"buffer"}:
            with self.subTest(name=name), self.assertRaises(ValueError):
                calculate_runway(**{**inputs, name: -1})

    def test_nonfinite_inputs(self):
        inputs = dict(
            inflow=1000, spending=2000, buffer=6000, bills=400,
            income_retained_pct=55, bills_increase_pct=15, one_off_cost=0,
            monthly_outflow_reduction=0, extra_monthly_cost=0, extra_savings=0,
        )
        for name in inputs:
            for value in ("NaN", "Infinity", "-Infinity"):
                with self.subTest(name=name, value=value):
                    with self.assertRaisesRegex(ValueError, "finite"):
                        calculate_runway(**{**inputs, name: value})

    def test_monthly_outflow_adjustments(self):
        result = calculate_runway(
            1000, 2000, 6000, monthly_outflow_reduction=500,
            extra_monthly_cost=100,
        )
        self.assertEqual(result["spending_after_shock"], 1600)
        self.assertEqual(result["runway_months"], 10)
        result = calculate_runway(0, 2000, 6000, monthly_outflow_reduction=2000)
        self.assertEqual(result["status"], "no_shortfall")
        with self.assertRaises(ValueError):
            calculate_runway(1000, 2000, 6000, monthly_outflow_reduction=2001)

if __name__ == "__main__":
    unittest.main()
