-- Add methodology_version and reviewed_at to snapshot_metadata
ALTER TABLE snapshot_metadata
  ADD COLUMN IF NOT EXISTS methodology_version TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at DATE;