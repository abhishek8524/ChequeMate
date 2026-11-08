CREATE OR REPLACE VIEW `tangerine-datathon.tangerine_silver.monthly_transactions` AS
SELECT
  account_id,
  transaction_month AS month,

  SUM(
    CASE WHEN flow_type = 'credit'
    THEN amount ELSE 0 END
  ) AS money_in_calc,

  SUM(
    CASE WHEN flow_type = 'debit'
    THEN amount ELSE 0 END
  ) AS money_out_calc,

  COUNT(*) AS transaction_count

FROM `tangerine-datathon.tangerine_silver.transactions_clean`

GROUP BY account_id, transaction_month;
