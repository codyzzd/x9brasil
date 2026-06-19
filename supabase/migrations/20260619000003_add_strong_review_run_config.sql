ALTER TABLE classification_runs
  ADD COLUMN IF NOT EXISTS strong_review_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS strong_provider TEXT,
  ADD COLUMN IF NOT EXISTS strong_model TEXT;
