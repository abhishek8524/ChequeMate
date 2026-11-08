CREATE OR REPLACE TABLE
`tangerine-datathon.tangerine_gold.account_metrics` AS

WITH medians AS (
  SELECT DISTINCT
    account_id,
    PERCENTILE_CONT(money_in, 0.5)
      OVER (PARTITION BY account_id) AS I,
    PERCENTILE_CONT(money_out, 0.5)
      OVER (PARTITION BY account_id) AS S,
    PERCENTILE_CONT(
      household_bills + insurance + loan_payments, 0.5
    ) OVER (PARTITION BY account_id) AS F,
    PERCENTILE_CONT(household_bills, 0.5)
      OVER (PARTITION BY account_id) AS H
  FROM `tangerine-datathon.tangerine_silver.monthly_summary_clean`
),

last_six_months AS (
  SELECT
    account_id,
    AVG(avg_daily_balance) AS B
  FROM (
    SELECT
      account_id,
      avg_daily_balance,
      ROW_NUMBER() OVER (
        PARTITION BY account_id
        ORDER BY month_date DESC
      ) AS rn
    FROM `tangerine-datathon.tangerine_silver.monthly_summary_clean`
  )
  WHERE rn <= 6
  GROUP BY account_id
),

active_loans AS (
  SELECT
    account_id,
    SUM(monthly_payment) AS P
  FROM `tangerine-datathon.tangerine_bronze.loans`
  WHERE loan_start <= DATE '2025-12-31'
    AND DATE_ADD(
      loan_start, INTERVAL duration_months MONTH
    ) > DATE '2025-12-31'
  GROUP BY account_id
)

SELECT
  a.account_id,
  m.I,
  m.S,
  m.F,
  m.H,
  b.B,
  COALESCE(l.P, 0) AS P

FROM `tangerine-datathon.tangerine_bronze.accounts` a
LEFT JOIN medians m USING (account_id)
LEFT JOIN last_six_months b USING (account_id)
LEFT JOIN active_loans l USING (account_id);
