"""HTTP boundary for the deterministic financial engine."""

import os
from calendar import monthrange
from datetime import date
from decimal import Decimal, DecimalException
from typing import Annotated, Any, Literal

import psycopg
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from backend import database
from backend import resilience, explanations
from backend.simulator import calculate_runway

Nonnegative = Annotated[Decimal, Field(ge=0, allow_inf_nan=False, max_digits=20, decimal_places=10)]
AccountId = Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)]
GoldAmount = Annotated[Decimal, Field(ge=0, allow_inf_nan=False, max_digits=28)]


class Metrics(BaseModel):
    account_id: AccountId
    I: GoldAmount
    S: GoldAmount
    F: GoldAmount
    H: GoldAmount
    B: Annotated[Decimal, Field(allow_inf_nan=False, max_digits=28)]
    P: GoldAmount


class Assumptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    income_retained_pct: Annotated[Nonnegative, Field(le=100)] = Decimal(100)
    bills_increase_pct: Nonnegative = Decimal(0)
    one_off_cost: Nonnegative = Decimal(0)
    monthly_outflow_reduction: Nonnegative = Decimal(0)
    extra_monthly_cost: Nonnegative = Decimal(0)
    extra_savings: Nonnegative = Decimal(0)


class SimulationRequest(Assumptions):
    account_id: AccountId


class PlanRequest(SimulationRequest):
    target_months: Annotated[Nonnegative, Field(gt=0, le=120)] = Decimal(6)


class SupportRequest(SimulationRequest):
    income_retained_pct: Annotated[Nonnegative, Field(le=100)] = Decimal(55)
    support_months: Annotated[int, Field(strict=True, ge=1, le=120)] = 6
    post_support_income_retained_pct: Annotated[Nonnegative, Field(le=100)]


class HistoryMonth(BaseModel):
    month: date
    money_in: GoldAmount
    money_out: GoldAmount
    avg_daily_balance: Annotated[Decimal, Field(allow_inf_nan=False, max_digits=28)]
    days_below_zero: Annotated[int, Field(ge=0, le=31)]

    @model_validator(mode="after")
    def valid_days(self):
        if self.days_below_zero > monthrange(self.month.year, self.month.month)[1]:
            raise ValueError("Invalid negative balance day count")
        return self


class SimulationResponse(BaseModel):
    original_metrics: Metrics
    scenario_assumptions: Assumptions
    income_after_shock: float
    spending_after_shock: float
    buffer_left: float
    monthly_shortfall: float
    runway_months: float
    runway_display: str
    status: Literal["buffer_exhausted", "no_shortfall", "capped", "shortfall"]
    calculation_breakdown: dict[str, Decimal]


app = FastAPI(title="ChequeMate Financial Resilience API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()],
    allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
)


def load_account(account_id: int) -> Metrics:
    try:
        row = database.fetch_account(account_id)
    except (database.DatabaseUnavailable, psycopg.Error):
        raise HTTPException(503, "Financial database unavailable") from None
    if row is None:
        raise HTTPException(404, "Account not found")
    try:
        metrics = Metrics.model_validate(row)
        if metrics.account_id != account_id:
            raise HTTPException(503, "Account metrics do not match requested account")
        return metrics
    except ValidationError:
        raise HTTPException(503, "Account metrics are invalid or incomplete") from None


@app.get("/api/health")
def health():
    """Readiness checks connectivity; no account data or credentials are exposed."""
    try:
        database.check_health()
    except (database.DatabaseUnavailable, psycopg.Error):
        raise HTTPException(503, "Financial database unavailable") from None
    return {"status": "ok", "database": "ok"}


@app.get("/api/accounts/{account_id}", response_model=Metrics)
def account(account_id: Annotated[int, Path(gt=0, le=9223372036854775807)]):
    return load_account(account_id)


@app.post("/api/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest):
    metrics = load_account(request.account_id)
    assumptions = Assumptions.model_validate(request.model_dump(exclude={"account_id"}))
    try:
        result = calculate_runway(
            inflow=metrics.I, spending=metrics.S, buffer=metrics.B,
            bills=metrics.H, **assumptions.model_dump(),
        )
    except (ValueError, DecimalException):
        raise HTTPException(422, "Scenario cannot be calculated with these inputs") from None
    income, spending, buffer = resilience.cashflows(metrics, assumptions)
    return {"original_metrics": metrics, "scenario_assumptions": assumptions, **result,
            "calculation_breakdown": {"income_after_exact": income, "outflow_after_exact": spending,
                "buffer_after_exact": buffer, "gap_exact": spending - income,
                "household_bill_increment": metrics.H * assumptions.bills_increase_pct / 100}}


def scenario_assumptions(request):
    return Assumptions.model_validate({k: getattr(request, k) for k in Assumptions.model_fields})


def load_history(account_id):
    try:
        rows = [HistoryMonth.model_validate(row) for row in database.fetch_history(account_id)]
        rows.sort(key=lambda row: row.month)
        keys = [(row.month.year, row.month.month) for row in rows]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate account months")
        # Rolling windows require consecutive calendar months.
        if any(b.month.year * 12 + b.month.month - (a.month.year * 12 + a.month.month) != 1
               for a, b in zip(rows, rows[1:])):
            raise ValueError("Missing account month")
        return resilience.history_insights(rows)
    except (database.DatabaseUnavailable, psycopg.Error):
        raise HTTPException(503, "Financial history unavailable") from None
    except (ValueError, DecimalException):
        raise HTTPException(503, "Financial history is invalid or incomplete") from None


@app.get("/api/accounts/{account_id}/insights", response_model=dict[str, Any])
def insights(account_id: Annotated[int, Path(gt=0, le=9223372036854775807)]):
    metrics = load_account(account_id)
    history = load_history(account_id)
    return {"account_id": account_id, "score": resilience.score(metrics, history), "insights": history}


@app.get("/api/accounts/{account_id}/profile", response_model=dict[str, Any])
def profile(account_id: Annotated[int, Path(gt=0, le=9223372036854775807)]):
    load_account(account_id)
    try:
        result = database.fetch_profile(account_id)
    except (database.DatabaseUnavailable, psycopg.Error):
        raise HTTPException(503, "Account profile unavailable") from None
    if result is None:
        raise HTTPException(404, "Account profile not found")
    return {"account_id": account_id, "profile": result}


@app.get("/api/accounts/{account_id}/lookalikes", response_model=dict[str, Any])
def lookalikes(account_id: Annotated[int, Path(gt=0, le=9223372036854775807)]):
    metrics = load_account(account_id)
    try:
        rows = database.fetch_lookalikes(account_id, metrics.I, metrics.B)
        peers = [Metrics.model_validate(row) for row in rows]
        distances = [NonnegativeValue.model_validate({"value": row["distance"]}).value for row in rows]
    except (database.DatabaseUnavailable, psycopg.Error, ValidationError, KeyError):
        raise HTTPException(503, "Comparison accounts unavailable") from None
    return {"account_id": account_id, "method": "Normalized absolute inflow and buffer distance; nearest five, no similarity threshold.",
            "peers": [{"metrics": peer, "distance": distance,
                       "income_shock": resilience.run(peer, Assumptions(income_retained_pct=55))}
                      for peer, distance in zip(peers, distances)],
            "limitation": "Descriptive comparison, not matched causal evidence."}


class NonnegativeValue(BaseModel):
    value: Annotated[Decimal, Field(ge=0, allow_inf_nan=False)]


def calculate_extension(request, calculation):
    metrics = load_account(request.account_id)
    assumptions = scenario_assumptions(request)
    try:
        return calculation(metrics, assumptions)
    except (ValueError, DecimalException):
        raise HTTPException(422, "Scenario cannot be calculated with these inputs") from None


@app.post("/api/plan", response_model=dict[str, Any])
def safety_net(request: PlanRequest):
    return calculate_extension(request, lambda m, a: resilience.plan(m, a, request.target_months))


@app.post("/api/simulate/support", response_model=dict[str, Any])
def support(request: SupportRequest):
    return calculate_extension(request, lambda m, a: resilience.temporary_support(
        m, a, request.support_months, request.post_support_income_retained_pct))


@app.post("/api/quest", response_model=dict[str, Any])
def resilience_quest(request: PlanRequest):
    return calculate_extension(request, lambda m, a: resilience.quest(
        m, a, load_history(request.account_id), request.target_months))


@app.post("/api/explain", response_model=dict[str, Any])
def explanation(request: SimulationRequest):
    return calculate_extension(request, lambda m, a: explanations.explain(resilience.run(m, a)))
