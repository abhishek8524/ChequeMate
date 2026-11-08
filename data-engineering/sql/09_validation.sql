
-- Check 1: Financial metrics
ASSERT (
  SELECT
    COUNT(*) = 4500
    AND COUNT(DISTINCT account_id) = 4500
    AND COUNTIF(I IS NULL OR S IS NULL OR H IS NULL) = 0
  FROM `tangerine-datathon.tangerine_gold.account_metrics`
) AS 'Financial metrics validation failed';

-- Check 2: Enriched profiles
ASSERT (
  SELECT
    COUNT(*) = 4500
    AND COUNT(DISTINCT account_id) = 4500
  FROM `tangerine-datathon.tangerine_gold.account_profiles`
) AS 'Account profiles validation failed';

-- Check 3: Historical records
ASSERT (
  SELECT COUNT(*) = 185326
  FROM `tangerine-datathon.tangerine_gold.account_monthly_history`
) AS 'Monthly history validation failed';

-- Check 4: Transactions
ASSERT (
  SELECT COUNT(*) = 1056320
  FROM `tangerine-datathon.tangerine_silver.transactions_clean`
) AS 'Transaction count validation failed';

-- Check 5: Transaction categorization
ASSERT (
  SELECT COUNTIF(category = 'unclassified') = 0
  FROM `tangerine-datathon.tangerine_silver.transactions_categorized`
) AS 'Unclassified transactions found';

-- Check 6: Financial reconciliation
ASSERT (
  SELECT COUNTIF(
    ABS(ms.money_in - COALESCE(tx.money_in_calc, 0)) > 0.01
    OR ABS(ms.money_out - COALESCE(tx.money_out_calc, 0)) > 0.01
  ) = 0
  FROM `tangerine-datathon.tangerine_silver.monthly_summary_clean` ms
  LEFT JOIN `tangerine-datathon.tangerine_silver.monthly_transactions` tx
    ON ms.account_id = tx.account_id
   AND ms.month_date = tx.month
) AS 'Financial reconciliation failed';

SELECT 'ALL DATA QUALITY CHECKS PASSED' AS result;
