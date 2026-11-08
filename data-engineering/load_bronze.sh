#!/usr/bin/env bash
set -euo pipefail

PROJECT="tangerine-datathon"
BUCKET="tangerine-datathon"

load() {
  local name="$1"
  local schema="$2"

  echo "Loading $name.csv..."

  bq --location=US load \
    --replace \
    --source_format=CSV \
    --skip_leading_rows=1 \
    --max_bad_records=0 \
    "$PROJECT:tangerine_bronze.$name" \
    "gs://$BUCKET/raw/$name.csv" \
    "$schema"
}

load accounts \
'account_id:INTEGER,district_id:INTEGER,frequency:STRING,account_opened:DATE'

load cards \
'card_id:INTEGER,disposition_id:INTEGER,card_type:STRING,issued:DATE'

load clients \
'client_id:INTEGER,gender:STRING,birth_date:DATE,district_id:INTEGER'

load dispositions \
'disposition_id:INTEGER,client_id:INTEGER,account_id:INTEGER,type:STRING'

load districts \
'district_id:INTEGER,district_name:STRING,region:STRING,inhabitants:INTEGER,municipalities_under_500:INTEGER,municipalities_500_1999:INTEGER,municipalities_2000_9999:INTEGER,municipalities_over_10000:INTEGER,num_cities:INTEGER,urban_ratio_pct:NUMERIC,average_salary:NUMERIC,unemployment_rate_2022:NUMERIC,unemployment_rate_2023:NUMERIC,entrepreneurs_per_1000:INTEGER,crimes_2022:INTEGER,crimes_2023:INTEGER'

load loans \
'loan_id:INTEGER,account_id:INTEGER,loan_start:DATE,amount:NUMERIC,duration_months:INTEGER,monthly_payment:NUMERIC,status:STRING,status_meaning:STRING,defaulted:INTEGER'

load monthly_summary \
'account_id:INTEGER,month:STRING,money_in:NUMERIC,money_out:NUMERIC,cash_deposits:NUMERIC,transfers_in:NUMERIC,pension_in:NUMERIC,interest_in:NUMERIC,household_bills:NUMERIC,insurance:NUMERIC,loan_payments:NUMERIC,bank_fees:NUMERIC,cash_withdrawals_genuine:NUMERIC,card_withdrawals:NUMERIC,transfers_out_other:NUMERIC,month_end_balance:NUMERIC,min_balance:NUMERIC,avg_daily_balance:NUMERIC,days_below_zero:NUMERIC'

load standing_orders \
'order_id:INTEGER,account_id:INTEGER,to_bank:STRING,to_account:STRING,amount:NUMERIC,purpose:STRING'

load transactions \
'transaction_id:INTEGER,account_id:INTEGER,date:DATE,direction:STRING,operation:STRING,purpose:STRING,amount:NUMERIC,signed_amount:NUMERIC,balance:NUMERIC,partner_bank:STRING,partner_account:STRING'

echo "All 9 Bronze tables loaded successfully."
