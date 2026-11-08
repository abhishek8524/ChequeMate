CREATE OR REPLACE TABLE
`tangerine-datathon.tangerine_gold.account_monthly_history` AS

SELECT
  account_id,
  month_date AS month,
  money_in,
  money_out,
  money_in - money_out AS net_cashflow,
  household_bills,
  insurance,
  loan_payments,
  avg_daily_balance,
  days_below_zero_int AS days_below_zero,

  SAFE_DIVIDE(money_out, money_in)
    AS outflow_to_inflow_ratio,

  AVG(money_out) OVER (
    PARTITION BY account_id
    ORDER BY month_date
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ) AS rolling_3month_outflow

FROM
`tangerine-datathon.tangerine_silver.monthly_summary_clean`;
