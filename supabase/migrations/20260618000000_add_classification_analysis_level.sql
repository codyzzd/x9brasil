ALTER TABLE proposal_classifications
  ADD COLUMN IF NOT EXISTS analysis_level INTEGER NOT NULL DEFAULT 1
  CHECK (analysis_level IN (1, 2, 3));

ALTER TABLE vote_classifications
  ADD COLUMN IF NOT EXISTS analysis_level INTEGER NOT NULL DEFAULT 1
  CHECK (analysis_level IN (1, 2, 3));

UPDATE proposal_classifications
SET analysis_level = CASE
  WHEN source = 'rule' THEN 1
  ELSE 2
END
WHERE analysis_level IS NULL OR analysis_level = 1;

UPDATE vote_classifications
SET analysis_level = CASE
  WHEN source = 'rule' THEN 1
  ELSE 2
END
WHERE analysis_level IS NULL OR analysis_level = 1;

CREATE INDEX IF NOT EXISTS idx_proposal_classifications_level
  ON proposal_classifications(analysis_level);

CREATE INDEX IF NOT EXISTS idx_vote_classifications_level
  ON vote_classifications(analysis_level);
