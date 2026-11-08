CREATE OR REPLACE VIEW `tangerine-datathon.tangerine_silver.transactions_categorized` AS
SELECT
  t.*,

  CASE
    WHEN flow_type = 'credit'
      AND operation = 'cash deposit'
      THEN 'cash_deposits'

    WHEN flow_type = 'credit'
      AND operation = 'interest'
      THEN 'interest_in'

    WHEN flow_type = 'credit'
      AND purpose = 'pension'
      THEN 'pension_in'

    WHEN flow_type = 'credit'
      AND operation = 'transfer in from another bank'
      AND purpose IS NULL
      THEN 'transfers_in'

    WHEN flow_type = 'debit'
      AND purpose = 'household bills'
      THEN 'household_bills'

    WHEN flow_type = 'debit'
      AND purpose = 'insurance'
      THEN 'insurance'

    WHEN flow_type = 'debit'
      AND purpose = 'loan payment'
      THEN 'loan_payments'

    WHEN flow_type = 'debit'
      AND operation = 'bank fee'
      THEN 'bank_fees'

    WHEN flow_type = 'debit'
      AND operation = 'cash withdrawal'
      THEN 'cash_withdrawals_genuine'

    WHEN flow_type = 'debit'
      AND operation = 'card withdrawal'
      THEN 'card_withdrawals'

    WHEN flow_type = 'debit'
      AND operation = 'transfer out to another bank'
      AND purpose IS NULL
      THEN 'transfers_out_other'

    ELSE 'unclassified'
  END AS category

FROM
`tangerine-datathon.tangerine_silver.transactions_clean` t;
