-- Idempotent sync keys and read-path indexes for the Supabase-backed app.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_legislator_proposals_scope
  ON legislator_proposals (
    legislator_id,
    proposal_id,
    period_id,
    participation_role,
    proposal_nature
  );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_legislator_votes_scope
  ON legislator_votes (
    legislator_id,
    vote_id,
    period_id,
    candidate_vote
  );

CREATE INDEX IF NOT EXISTS idx_legislator_period_suppliers_total
  ON legislator_period_suppliers (legislator_id, period_id, total DESC);

CREATE INDEX IF NOT EXISTS idx_legislator_period_largest_expenses_value
  ON legislator_period_largest_expenses (legislator_id, period_id, value DESC);

CREATE INDEX IF NOT EXISTS idx_legislator_amendments_transferred
  ON legislator_amendments (legislator_id, period_id, transferred_value DESC);

CREATE INDEX IF NOT EXISTS idx_legislator_votes_score_delta
  ON legislator_votes (legislator_id, period_id, score_delta DESC);

CREATE INDEX IF NOT EXISTS idx_legislator_proposals_period
  ON legislator_proposals (period_id, legislator_id, proposal_id);

CREATE INDEX IF NOT EXISTS idx_votes_date
  ON votes (vote_date DESC);

CREATE INDEX IF NOT EXISTS idx_proposals_date
  ON proposals (proposal_date DESC);
