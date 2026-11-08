
"""Financial shock calculations using the Tangerine judging rules."""

from decimal import Decimal, ROUND_HALF_UP


def _number(value):
    number = Decimal(str(value))
    if not number.is_finite():
        raise ValueError("Inputs must be finite numbers")
    return number


def _two_decimals(value):
    return float(
        value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    )


def calculate_runway(
    inflow,
    spending,
    buffer,
    bills=0,
    income_retained_pct=100,
    bills_increase_pct=0,
    one_off_cost=0,
    monthly_outflow_reduction=0,
    extra_monthly_cost=0,
    extra_savings=0,
):
    """
    Calculate financial runway for one account and scenario.

    inflow: typical monthly money in (I)
    spending: typical monthly money out (S)
    buffer: financial buffer (B)
    bills: typical household bills (H)

    Percentages use 55 for 55%, not 0.55.
    """

    I = _number(inflow)
    S = _number(spending)
    B = _number(buffer)
    H = _number(bills)

    income_pct = _number(income_retained_pct)
    bill_pct = _number(bills_increase_pct)
    one_off = _number(one_off_cost)
    reduction = _number(monthly_outflow_reduction)
    extra_cost = _number(extra_monthly_cost)
    savings = _number(extra_savings)

    # Validate inputs
    if not 0 <= income_pct <= 100:
        raise ValueError(
            "income_retained_pct must be between 0 and 100"
        )

    if any(
        value < 0
        for value in (
            I, S, H, bill_pct, one_off,
            reduction, extra_cost, savings
        )
    ):
        raise ValueError(
            "Inputs other than buffer cannot be negative"
        )

    # Step 1: Calculate the new monthly income
    income_after = I * income_pct / 100

    # Step 2: Calculate the new monthly outflows
    spending_after = (
        S + H * bill_pct / 100
        + extra_cost - reduction
    )

    if spending_after < 0:
        raise ValueError(
            "Monthly outflow reduction exceeds simulated outflow"
        )

    # Step 3: Adjust the financial buffer
    buffer_left = B + savings - one_off

    # Step 4: Calculate the monthly shortfall
    gap = spending_after - income_after

    # Step 5: Calculate survival runway
    if buffer_left <= 0:
        status = "buffer_exhausted"
        runway = Decimal("0")
        runway_display = "0.0 months"

    elif gap <= 0:
        status = "no_shortfall"
        runway = Decimal("120")
        runway_display = "No shortfall (120+)"

    else:
        uncapped = buffer_left / gap

        if uncapped >= 120:
            status = "capped"
            runway = Decimal("120")
            runway_display = "120.0 months"

        else:
            status = "shortfall"
            runway = uncapped.quantize(
                Decimal("0.1"), rounding=ROUND_HALF_UP
            )
            runway_display = f"{runway:.1f} months"

    # Return calculated results
    return {
        "income_after_shock": _two_decimals(income_after),
        "spending_after_shock": _two_decimals(spending_after),
        "buffer_left": _two_decimals(buffer_left),
        "monthly_shortfall": _two_decimals(
            max(gap, Decimal("0"))
        ),
        "runway_months": float(runway),
        "runway_display": runway_display,
        "status": status,
    }
