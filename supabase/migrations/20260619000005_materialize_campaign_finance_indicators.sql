ALTER TABLE legislator_period_metrics
  ADD COLUMN IF NOT EXISTS campaign_donors_count INTEGER,
  ADD COLUMN IF NOT EXISTS campaign_donor_top3_share NUMERIC,
  ADD COLUMN IF NOT EXISTS campaign_suppliers_count INTEGER,
  ADD COLUMN IF NOT EXISTS campaign_supplier_top3_share NUMERIC;

WITH donor_ranked AS (
  SELECT
    legislator_id,
    period_id,
    value,
    ROW_NUMBER() OVER (
      PARTITION BY legislator_id, period_id
      ORDER BY value DESC
    ) AS position
  FROM legislator_period_top_donors
),
donor_aggregates AS (
  SELECT
    legislator_id,
    period_id,
    COUNT(*)::INTEGER AS donors_count,
    CASE
      WHEN SUM(value) > 0 THEN SUM(value) FILTER (WHERE position <= 3) / SUM(value)
      ELSE NULL
    END AS donor_top3_share
  FROM donor_ranked
  GROUP BY legislator_id, period_id
),
supplier_ranked AS (
  SELECT
    legislator_id,
    period_id,
    value,
    ROW_NUMBER() OVER (
      PARTITION BY legislator_id, period_id
      ORDER BY value DESC
    ) AS position
  FROM legislator_period_top_campaign_suppliers
),
supplier_aggregates AS (
  SELECT
    legislator_id,
    period_id,
    COUNT(*)::INTEGER AS suppliers_count,
    CASE
      WHEN SUM(value) > 0 THEN SUM(value) FILTER (WHERE position <= 3) / SUM(value)
      ELSE NULL
    END AS supplier_top3_share
  FROM supplier_ranked
  GROUP BY legislator_id, period_id
)
UPDATE legislator_period_metrics metrics
SET
  campaign_donors_count = COALESCE(donor_aggregates.donors_count, 0),
  campaign_donor_top3_share = donor_aggregates.donor_top3_share,
  campaign_suppliers_count = COALESCE(supplier_aggregates.suppliers_count, 0),
  campaign_supplier_top3_share = supplier_aggregates.supplier_top3_share
FROM donor_aggregates
FULL OUTER JOIN supplier_aggregates
  ON supplier_aggregates.legislator_id = donor_aggregates.legislator_id
  AND supplier_aggregates.period_id = donor_aggregates.period_id
WHERE metrics.legislator_id = COALESCE(donor_aggregates.legislator_id, supplier_aggregates.legislator_id)
  AND metrics.period_id = COALESCE(donor_aggregates.period_id, supplier_aggregates.period_id);

UPDATE legislator_period_metrics
SET
  campaign_donors_count = COALESCE(campaign_donors_count, 0),
  campaign_suppliers_count = COALESCE(campaign_suppliers_count, 0)
WHERE campaign_donors_count IS NULL
  OR campaign_suppliers_count IS NULL;
