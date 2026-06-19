CREATE INDEX IF NOT EXISTS idx_legislator_votes_legislator_period_id_desc
  ON legislator_votes(legislator_id, period_id, id DESC);
