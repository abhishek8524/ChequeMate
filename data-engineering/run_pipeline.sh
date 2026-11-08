#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Starting Cashflow Paradox pipeline..."

SQL_FILES=(
  "sql/01_transactions_clean.sql"
  "sql/02_monthly_summary_clean.sql"
  "sql/03_monthly_transactions.sql"
  "sql/04_transactions_categorized.sql"
  "sql/05_account_context.sql"
  "sql/06_account_metrics.sql"
  "sql/07_account_monthly_history.sql"
  "sql/08_account_profiles.sql"
  "sql/09_validation.sql"
)

for file in "${SQL_FILES[@]}"; do
  echo "Running: $file"
  bq query \
    --location=US \
    --use_legacy_sql=false \
    < "$file"
done

echo "All Silver and Gold transformations completed!"
