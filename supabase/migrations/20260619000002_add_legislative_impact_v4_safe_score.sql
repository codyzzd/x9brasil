ALTER TABLE vote_classifications
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS model_role TEXT,
  ADD COLUMN IF NOT EXISTS analysis_status TEXT,
  ADD COLUMN IF NOT EXISTS risk_level TEXT,
  ADD COLUMN IF NOT EXISTS needs_strong_review BOOLEAN,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS coverage_category TEXT,
  ADD COLUMN IF NOT EXISTS affects_score BOOLEAN,
  ADD COLUMN IF NOT EXISTS score_safety_reason TEXT;

ALTER TABLE legislator_votes
  ADD COLUMN IF NOT EXISTS score_points NUMERIC,
  ADD COLUMN IF NOT EXISTS affects_score BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS analysis_status TEXT,
  ADD COLUMN IF NOT EXISTS needs_strong_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS coverage_category TEXT,
  ADD COLUMN IF NOT EXISTS score_safety_reason TEXT,
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS model_role TEXT;

CREATE INDEX IF NOT EXISTS idx_vote_classifications_analysis_status
  ON vote_classifications(analysis_status);

CREATE INDEX IF NOT EXISTS idx_vote_classifications_needs_strong_review
  ON vote_classifications(needs_strong_review)
  WHERE needs_strong_review = true;

CREATE INDEX IF NOT EXISTS idx_legislator_votes_analysis_status
  ON legislator_votes(legislator_id, period_id, analysis_status);

CREATE INDEX IF NOT EXISTS idx_legislator_votes_affects_score
  ON legislator_votes(legislator_id, period_id, affects_score)
  WHERE affects_score = true;
