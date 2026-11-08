# ChequeMate — Data Engineering

## Architecture
Google Cloud Storage -> BigQuery Bronze -> Silver -> Gold

## Technology
Google Cloud Storage, BigQuery, SQL, Bash

## Data
- 9 banking datasets
- 4,500 accounts
- 1,056,320 transactions
- 185,326 monthly financial records

## Pipeline
- load_bronze.sh: loads CSVs into Bronze
- run_pipeline.sh: executes Silver, Gold and validation SQL

## Silver
5 views for cleaning, aggregation, categorization,
reconciliation and account enrichment.

## Gold
- account_metrics
- account_monthly_history
- account_profiles

## Quality Checks
6 automated SQL assertions, including row counts,
uniqueness, categorization and financial reconciliation.

## Execution
Requires configured Google Cloud access, BigQuery
datasets and source CSV files in Cloud Storage.

bash load_bronze.sh
bash run_pipeline.sh

The pipeline is triggered manually.
Source datasets and credentials are not stored in Git.
