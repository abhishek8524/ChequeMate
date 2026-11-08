"""HTTP boundary for the deterministic financial engine."""

import os
from decimal import Decimal, DecimalException
from typing import Annotated, Literal

import psycopg
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend import database
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
        return Metrics.model_validate(row)
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
    return {"original_metrics": metrics, "scenario_assumptions": assumptions, **result}
