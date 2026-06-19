CREATE INDEX IF NOT EXISTS idx_legislator_votes_vote_id_id
  ON legislator_votes(vote_id, id);

CREATE INDEX IF NOT EXISTS idx_legislator_votes_period_legislator_id
  ON legislator_votes(period_id, legislator_id, id);

CREATE INDEX IF NOT EXISTS idx_vote_classifications_vote_id_id
  ON vote_classifications(vote_id, id);
