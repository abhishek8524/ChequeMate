CREATE OR REPLACE VIEW `tangerine-datathon.tangerine_silver.monthly_summary_clean` AS
SELECT
  *,
  SAFE.PARSE_DATE('%Y-%m', month) AS month_date,

  CASE
    WHEN days_below_zero = TRUNC(days_below_zero)
      THEN CAST(days_below_zero AS INT64)
    ELSE NULL
  END AS days_below_zero_int

FROM `tangerine-datathon.tangerine_bronze.monthly_summary`;
