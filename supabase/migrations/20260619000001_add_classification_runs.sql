CREATE TABLE IF NOT EXISTS classification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL CHECK (target IN ('votes', 'proposals', 'both')),
  analysis_level INTEGER NOT NULL CHECK (analysis_level IN (2, 3)),
  scope TEXT NOT NULL CHECK (scope IN ('improvable', 'overwrite')),
  limit_per_target INTEGER NOT NULL,
  concurrency INTEGER NOT NULL,
  post_process_mode TEXT NOT NULL CHECK (post_process_mode IN ('classify_only', 'classify_and_recalculate', 'materialize_only')),
  provider TEXT,
  model TEXT,
  method_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  processing_count INTEGER NOT NULL DEFAULT 0,
  classified_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classification_run_items (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES classification_runs(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('votes', 'proposals')),
  item_id TEXT NOT NULL,
  item_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'classified', 'failed', 'skipped')),
  error_kind TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, target, item_id)
);

CREATE INDEX IF NOT EXISTS idx_classification_runs_status_updated
  ON classification_runs(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_classification_run_items_run_status
  ON classification_run_items(run_id, status, target, item_id);

ALTER TABLE classification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on classification_runs"
  ON classification_runs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on classification_run_items"
  ON classification_run_items FOR ALL
  USING (auth.role() = 'service_role');
