ALTER TABLE legislator_period_metrics
  ADD COLUMN IF NOT EXISTS plenary_sessions_total INTEGER,
  ADD COLUMN IF NOT EXISTS nominal_votes_total INTEGER;
