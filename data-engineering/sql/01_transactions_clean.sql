CREATE OR REPLACE VIEW `tangerine-datathon.tangerine_silver.transactions_clean` AS
WITH cleaned AS (
  SELECT
    t.transaction_id,
    t.account_id,
    t.date AS transaction_date,
    DATE_TRUNC(t.date, MONTH) AS transaction_month,
    t.direction,
    t.operation,
    NULLIF(TRIM(t.purpose), '') AS purpose,
    t.amount,
    t.signed_amount,
    t.balance,

    CASE
      WHEN t.direction = 'credit (money in)'
        THEN 'credit'
      WHEN t.direction = 'debit (money out)'
        THEN 'debit'
      ELSE 'unknown'
    END AS flow_type,

    ROW_NUMBER() OVER (
      PARTITION BY t.transaction_id
      ORDER BY t.date, t.account_id
    ) AS row_num

  FROM `tangerine-datathon.tangerine_bronze.transactions` t

  WHERE t.transaction_id IS NOT NULL
    AND t.account_id IS NOT NULL
    AND t.date IS NOT NULL
    AND t.amount IS NOT NULL
    AND t.amount >= 0
    AND EXISTS (
      SELECT 1
      FROM `tangerine-datathon.tangerine_bronze.accounts` a
      WHERE a.account_id = t.account_id
    )
)

SELECT * EXCEPT(row_num)
FROM cleaned
WHERE row_num = 1;
