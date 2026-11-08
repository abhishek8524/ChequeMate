CREATE OR REPLACE VIEW `tangerine-datathon.tangerine_silver.account_context` AS
WITH client_counts AS (
  SELECT
    account_id,
    COUNT(DISTINCT client_id) AS linked_clients,
    COUNT(DISTINCT IF(
      LOWER(TRIM(type)) = 'owner',
      client_id,
      NULL
    )) AS owner_count
  FROM `tangerine-datathon.tangerine_bronze.dispositions`
  GROUP BY account_id
),

card_counts AS (
  SELECT
    d.account_id,
    COUNT(DISTINCT c.card_id) AS card_count
  FROM `tangerine-datathon.tangerine_bronze.dispositions` d
  LEFT JOIN `tangerine-datathon.tangerine_bronze.cards` c
    USING (disposition_id)
  GROUP BY d.account_id
),

standing_order_metrics AS (
  SELECT
    account_id,
    COUNT(*) AS standing_order_count,
    SUM(amount) AS standing_order_total
  FROM `tangerine-datathon.tangerine_bronze.standing_orders`
  GROUP BY account_id
)

SELECT
  a.account_id,
  a.district_id,
  dist.region,
  dist.district_name,
  COALESCE(cc.linked_clients, 0) AS linked_clients,
  COALESCE(cc.owner_count, 0) AS owner_count,
  COALESCE(cd.card_count, 0) AS card_count,
  COALESCE(so.standing_order_count, 0)
    AS standing_order_count,
  COALESCE(so.standing_order_total, 0)
    AS standing_order_total

FROM `tangerine-datathon.tangerine_bronze.accounts` a

LEFT JOIN `tangerine-datathon.tangerine_bronze.districts` dist
  USING (district_id)

LEFT JOIN client_counts cc
  USING (account_id)

LEFT JOIN card_counts cd
  USING (account_id)

LEFT JOIN standing_order_metrics so
  USING (account_id);
