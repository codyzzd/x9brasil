ALTER TABLE proposal_classifications
  ADD COLUMN IF NOT EXISTS analysis_method_version TEXT DEFAULT 'legislative-impact-v2',
  ADD COLUMN IF NOT EXISTS legislative_type TEXT,
  ADD COLUMN IF NOT EXISTS decision_nature TEXT,
  ADD COLUMN IF NOT EXISTS decision_scope TEXT,
  ADD COLUMN IF NOT EXISTS declared_benefit TEXT,
  ADD COLUMN IF NOT EXISTS hidden_cost TEXT,
  ADD COLUMN IF NOT EXISTS net_public_effect TEXT,
  ADD COLUMN IF NOT EXISTS has_tradeoff BOOLEAN,
  ADD COLUMN IF NOT EXISTS summary_matches_text TEXT,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB,
  ADD COLUMN IF NOT EXISTS critical_articles JSONB,
  ADD COLUMN IF NOT EXISTS analysis_payload JSONB;

ALTER TABLE vote_classifications
  ADD COLUMN IF NOT EXISTS analysis_method_version TEXT DEFAULT 'legislative-impact-v2',
  ADD COLUMN IF NOT EXISTS legislative_type TEXT,
  ADD COLUMN IF NOT EXISTS decision_nature TEXT,
  ADD COLUMN IF NOT EXISTS decision_scope TEXT,
  ADD COLUMN IF NOT EXISTS vote_object_type TEXT,
  ADD COLUMN IF NOT EXISTS vote_object_description TEXT,
  ADD COLUMN IF NOT EXISTS yes_means TEXT,
  ADD COLUMN IF NOT EXISTS no_means TEXT,
  ADD COLUMN IF NOT EXISTS analyzed_text_matches_vote_object TEXT,
  ADD COLUMN IF NOT EXISTS score_impact_limit TEXT,
  ADD COLUMN IF NOT EXISTS is_procedural_vote BOOLEAN,
  ADD COLUMN IF NOT EXISTS declared_benefit TEXT,
  ADD COLUMN IF NOT EXISTS hidden_cost TEXT,
  ADD COLUMN IF NOT EXISTS net_public_effect TEXT,
  ADD COLUMN IF NOT EXISTS has_tradeoff BOOLEAN,
  ADD COLUMN IF NOT EXISTS summary_matches_text TEXT,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB,
  ADD COLUMN IF NOT EXISTS critical_articles JSONB,
  ADD COLUMN IF NOT EXISTS analysis_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_vote_classifications_object_type
  ON vote_classifications(vote_object_type);

CREATE INDEX IF NOT EXISTS idx_vote_classifications_net_effect
  ON vote_classifications(net_public_effect);

CREATE INDEX IF NOT EXISTS idx_proposal_classifications_net_effect
  ON proposal_classifications(net_public_effect);
