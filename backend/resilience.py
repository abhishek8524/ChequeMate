"""Experimental, deterministic analysis. No predictive or credit assessment."""

from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from statistics import median

from backend.simulator import calculate_runway

D = Decimal
DISCLAIMER = "Experimental educational indicator, not a credit score or complete financial health assessment."


def cashflows(metrics, assumptions):
    income = metrics.I * assumptions.income_retained_pct / 100
    spending = (metrics.S + metrics.H * assumptions.bills_increase_pct / 100
                + assumptions.extra_monthly_cost - assumptions.monthly_outflow_reduction)
    if spending < 0:
        raise ValueError("Reduction exceeds outflow")
    return income, spending, metrics.B + assumptions.extra_savings - assumptions.one_off_cost


def run(metrics, assumptions):
    return calculate_runway(inflow=metrics.I, spending=metrics.S, buffer=metrics.B,
                            bills=metrics.H, **assumptions.model_dump())


def rounded(value):
    return value.quantize(D("0.01"), rounding=ROUND_HALF_UP)


def history_insights(rows):
    """Rows are validated and ordered by month at the API boundary."""
    if not rows:
        return {"available": False, "months": 0, "income_cv": None,
                "recent_stress_fraction": None, "timing_trap_months": [],
                "recovery": "insufficient_history", "cashflow_creep": None,
                "recent_negative_balance_days": None, "history": [],
                "expense_visibility": {"cash_withdrawal_share": None,
                    "limitation": "Monthly Gold history does not identify cash withdrawal purposes or share."}}
    incomes = [r.money_in for r in rows]
    average = sum(incomes) / len(rows)
    cv = ((sum((x - average) ** 2 for x in incomes) / len(rows)).sqrt() / average
          if average > 0 else None)
    recent = rows[-6:]
    stress = sum(r.days_below_zero > 0 for r in recent) / D(len(recent))
    traps = [r.month.isoformat() for r in rows
             if r.money_in >= r.money_out and r.days_below_zero > 0]
    recovery = "insufficient_history"
    if len(rows) >= 6:
        before = sum(r.days_below_zero for r in rows[-6:-3])
        after = sum(r.days_below_zero for r in rows[-3:])
        recovery = "improving" if after < before else "worsening" if after > before else "unchanged"
    creep = None
    if len(rows) >= 12:
        early, late = rows[:6], rows[-6:]
        ei, eo = median(r.money_in for r in early), median(r.money_out for r in early)
        li, lo = median(r.money_in for r in late), median(r.money_out for r in late)
        creep = {"early_inflow": ei, "recent_inflow": li, "early_outflow": eo,
                 "recent_outflow": lo, "outflow_growth_exceeds_inflow_growth":
                 (lo / eo - 1 > li / ei - 1) if ei > 0 and eo > 0 else None,
                 "limitation": "Descriptive association; spending purpose and necessity are unknown."}
    return {"available": True, "months": len(rows), "income_cv": cv,
            "recent_stress_fraction": stress, "timing_trap_months": traps,
            "recovery": recovery, "cashflow_creep": creep,
            "recent_negative_balance_days": sum(r.days_below_zero for r in recent),
            "expense_visibility": {"cash_withdrawal_share": None,
                "limitation": "Monthly Gold history does not identify cash withdrawal purposes or share."},
            "history": [r.model_dump() for r in rows]}


def score(metrics, history, *, income=None, spending=None, buffer=None):
    """Five equal components; unavailable history never earns invented points."""
    income = metrics.I if income is None else income
    spending = metrics.S if spending is None else spending
    buffer = metrics.B if buffer is None else buffer
    shock = calculate_runway(inflow=income, spending=spending, buffer=buffer,
                             income_retained_pct=55)
    gap = spending - income * D("0.55")
    shock_fraction = (D(0) if buffer <= 0 else D(1) if gap <= 0
                      else buffer / gap / 6)
    clamp = lambda x: max(D(0), min(D(1), x))
    values = {
        "shock_resilience": 20 * clamp(shock_fraction),
        "cashflow_health": 20 * clamp((income - spending) / income / D("0.2")) if income > 0 else D(0),
        "income_stability": (20 * clamp(1 - history["income_cv"])
                             if history["months"] >= 6 and history["income_cv"] is not None else None),
        "recent_balance_stress": (20 * (1 - history["recent_stress_fraction"])
                                  if history["months"] >= 6 else None),
        "recorded_debt_commitments": (20 * clamp(1 - metrics.P / income)
                                      if income > 0 else D(20) if metrics.P == 0 else D(0)),
    }
    return {"version": "experimental-v1", "label": DISCLAIMER,
            "score": rounded(sum(values.values())) if all(v is not None for v in values.values()) else None,
            "available_points": rounded(sum(v for v in values.values() if v is not None)),
            "available_maximum": 20 * sum(v is not None for v in values.values()),
            "components": {k: rounded(v) if v is not None else None for k, v in values.items()},
            "reference_shock": shock,
            "limitation": "P is recorded payment, not outstanding debt. Missing components are not imputed."}


def plan(metrics, assumptions, target):
    income, spending, buffer = cashflows(metrics, assumptions)
    gap = max(D(0), spending - income)
    # A zero buffer is exhausted even when there is no shortfall.
    required = max(gap * target, D("0.01"))
    extra = max(D(0), required - buffer).quantize(D("0.01"), rounding=ROUND_CEILING)
    improved = assumptions.model_copy(update={"extra_savings": assumptions.extra_savings + extra})
    return {"target_months": target, "additional_savings_needed": extra,
            "required_buffer": required, "monthly_shortfall_exact": gap,
            "current": run(metrics, assumptions), "with_target_savings": run(metrics, improved),
            "income_retention_break_even_pct": (spending / metrics.I * 100 if metrics.I > 0 else None),
            "monthly_outflow_reduction_to_break_even": gap,
            "limitation": "Hypothetical constant cashflows; positive opening buffer required."}


def temporary_support(metrics, assumptions, months, after_pct):
    income, spending, buffer = cashflows(metrics, assumptions)
    first_gap = spending - income
    after_income = metrics.I * after_pct / 100
    after_gap = spending - after_income
    balance = buffer
    path = []
    exhausted = D(0) if buffer <= 0 else None
    for month in range(1, 121):
        if exhausted is not None:
            break
        gap = first_gap if month <= months else after_gap
        opening = balance
        if exhausted is None and gap > 0 and opening <= gap:
            exhausted = D(month - 1) + opening / gap
        balance -= gap
        path.append({"month": month, "income": income if month <= months else after_income,
                     "spending": spending, "projected_balance": balance})
        if exhausted is not None:
            break
    runway = min(exhausted, D(120)) if exhausted is not None else D(120)
    return {"support_months": months, "post_support_income_retained_pct": after_pct,
            "runway_months": runway.quantize(D("0.1"), rounding=ROUND_HALF_UP),
            "status": "buffer_exhausted" if buffer <= 0 else "shortfall" if exhausted is not None else "horizon_reached",
            "projection": path,
            "limitation": "Hypothetical income support; does not establish EI eligibility. Projection stops at exhaustion or the horizon."}


def quest(metrics, assumptions, history, target):
    income, spending, buffer = cashflows(metrics, assumptions)
    baseline = score(metrics, history)
    simulated = score(metrics, history, income=income, spending=spending, buffer=buffer)
    savings = plan(metrics, assumptions, target)
    cards = []
    for name, changes in [("target_safety_net", {"extra_savings": assumptions.extra_savings + savings["additional_savings_needed"]}),
                          ("reduce_outflow_ten_percent", {"monthly_outflow_reduction": assumptions.monthly_outflow_reduction + spending / 10}),
                          ("restore_original_income", {"income_retained_pct": D(100)})]:
        alternative = assumptions.model_copy(update=changes)
        ai, asp, ab = cashflows(metrics, alternative)
        cards.append({"id": name, "assumptions": alternative.model_dump(), "result": run(metrics, alternative),
                      "score": score(metrics, history, income=ai, spending=asp, buffer=ab)})
    missions = [{"id": "safety_net", "text": "Explore the savings needed for your chosen runway target.", "hypothetical": True}]
    if history["timing_trap_months"]:
        missions.append({"id": "bill_timing", "text": "Compare bill due dates with income arrival dates.", "hypothetical": True})
    if history["income_cv"] is not None and history["income_cv"] > D("0.3"):
        missions.append({"id": "variable_income", "text": "Test a lower income month before choosing a buffer target.", "hypothetical": True})
    return {"baseline_score": baseline, "simulated_score": simulated,
            "score_change": simulated["score"] - baseline["score"] if baseline["score"] is not None else None,
            "safety_net": savings, "decision_cards": cards, "missions": missions,
            "progress_persisted": False, "limitation": "Simulations do not establish real-world mission completion."}
