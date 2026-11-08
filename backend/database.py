"""Read validated Gold metrics; never recalculate them from raw data."""

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


class DatabaseUnavailable(RuntimeError):
    """Database configuration or connectivity is unavailable."""


def connect():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise DatabaseUnavailable("Database is not configured")
    return psycopg.connect(
        url, row_factory=dict_row, connect_timeout=10,
        options="-c default_transaction_read_only=on -c statement_timeout=10000",
    )


def fetch_account(account_id: int):
    with connect() as connection:
        return connection.execute(
            'SELECT account_id, "I", "S", "F", "H", "B", "P" '
            'FROM public.gold_account_metrics WHERE account_id = %s',
            (account_id,),
        ).fetchone()


def check_health():
    with connect() as connection:
        connection.execute("SELECT 1").fetchone()
