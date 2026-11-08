CREATE OR REPLACE TABLE
`tangerine-datathon.tangerine_gold.account_profiles` AS

SELECT
  m.account_id,

  -- Financial metrics
  m.I AS monthly_inflow,
  m.S AS monthly_outflow,
  m.F AS fixed_costs,
  m.H AS household_bills,
  m.B AS financial_buffer,
  m.P AS loan_payment,

  -- Financial indicators
  m.I - m.S AS net_monthly_cashflow,
  SAFE_DIVIDE(m.S, m.I) AS outflow_ratio,

  -- Regional information
  c.district_id,
  c.district_name,
  c.region,

  -- Account information
  c.linked_clients,
  c.owner_count,
  c.card_count,
  c.standing_order_count,
  c.standing_order_total

FROM
`tangerine-datathon.tangerine_gold.account_metrics` m

LEFT JOIN
`tangerine-datathon.tangerine_silver.account_context` c
USING (account_id);
