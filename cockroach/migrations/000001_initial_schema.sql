-- Score Brasil - CockroachDB schema
-- Consolidated from the Supabase migrations. Supabase-specific RLS policies,
-- auth.role() checks, and extensions are intentionally omitted.

CREATE TABLE IF NOT EXISTS legislators (
  id INT8 PRIMARY KEY,
  slug STRING NOT NULL UNIQUE,
  name STRING NOT NULL,
  civil_name STRING,
  photo_url STRING,
  chamber_url STRING,
  chamber STRING NOT NULL DEFAULT 'camara' CHECK (chamber IN ('camara', 'senado')),
  election_number STRING,
  tse_sequence STRING,
  election_status STRING,
  assets_total DECIMAL,
  assets_count INT4,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legislator_details (
  legislator_id INT8 PRIMARY KEY REFERENCES legislators(id) ON DELETE CASCADE,
  birth_date DATE,
  birth_place STRING,
  education STRING,
  office STRING
);

CREATE TABLE IF NOT EXISTS legislator_assets (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  type STRING NOT NULL,
  description STRING,
  value DECIMAL NOT NULL
);

CREATE TABLE IF NOT EXISTS legislator_staff (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  role STRING,
  start_date DATE
);

CREATE TABLE IF NOT EXISTS periods (
  id STRING PRIMARY KEY,
  label STRING NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_partial BOOL NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS legislator_period_metrics (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  party STRING NOT NULL,
  state STRING NOT NULL,
  office_start DATE NOT NULL,
  office_end DATE NOT NULL,
  days_in_office INT4 NOT NULL,
  months_in_office DECIMAL NOT NULL,
  plenary_attendances INT4,
  plenary_sessions_total INT4,
  nominal_votes INT4,
  nominal_votes_total INT4,
  substantive_proposals INT4,
  oversight_proposals INT4,
  advanced_proposals INT4,
  converted_proposals INT4,
  author_proposals INT4,
  coauthor_proposals INT4,
  requester_proposals INT4,
  fiscalization_proposals INT4,
  expenses_total DECIMAL,
  expense_documents INT4,
  supplier_concentration DECIMAL,
  campaign_candidacy_available BOOL DEFAULT false,
  assets_available BOOL DEFAULT false,
  total_votes INT4,
  total_campaign_receipts DECIMAL,
  total_public_receipts DECIMAL,
  total_campaign_expenses DECIMAL,
  public_contribution_points DECIMAL,
  public_classified_proposals INT4 DEFAULT 0,
  public_total_proposals INT4 DEFAULT 0,
  public_vote_positive_points DECIMAL DEFAULT 0,
  public_vote_negative_penalties DECIMAL DEFAULT 0,
  public_vote_absence_penalties DECIMAL DEFAULT 0,
  public_votes_analyzed INT4 DEFAULT 0,
  public_vote_average_confidence DECIMAL,
  public_vote_score DECIMAL,
  campaign_donors_count INT4,
  campaign_donor_top3_share DECIMAL,
  campaign_suppliers_count INT4,
  campaign_supplier_top3_share DECIMAL,
  UNIQUE(legislator_id, period_id)
);

CREATE TABLE IF NOT EXISTS legislator_period_top_donors (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  value DECIMAL NOT NULL
);

CREATE TABLE IF NOT EXISTS legislator_period_top_campaign_suppliers (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  value DECIMAL NOT NULL
);

CREATE TABLE IF NOT EXISTS legislator_period_expense_categories (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  total DECIMAL NOT NULL,
  documents INT4 NOT NULL
);

CREATE TABLE IF NOT EXISTS legislator_period_suppliers (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name STRING NOT NULL,
  tax_id STRING,
  total DECIMAL NOT NULL,
  documents INT4 NOT NULL
);

CREATE TABLE IF NOT EXISTS legislator_period_largest_expenses (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  category STRING NOT NULL,
  supplier STRING,
  expense_date DATE,
  value DECIMAL NOT NULL,
  document_url STRING
);

CREATE TABLE IF NOT EXISTS proposals (
  id STRING PRIMARY KEY,
  type STRING,
  number STRING,
  year STRING,
  proposal_date DATE,
  summary STRING,
  status STRING,
  url STRING,
  chamber_url STRING
);

CREATE TABLE IF NOT EXISTS legislator_proposals (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  proposal_id STRING NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  participation_role STRING NOT NULL,
  participation_label STRING NOT NULL,
  proposal_nature STRING NOT NULL,
  proposal_nature_label STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS proposal_classifications (
  proposal_id STRING PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
  category STRING NOT NULL,
  confidence STRING NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  justification STRING,
  source STRING NOT NULL DEFAULT 'rule' CHECK (source IN ('reviewed', 'rule', 'llm')),
  analysis_level INT4 NOT NULL DEFAULT 1 CHECK (analysis_level IN (1, 2, 3)),
  methodology_version STRING,
  analysis_method_version STRING DEFAULT 'legislative-impact-v2',
  legislative_type STRING,
  decision_nature STRING,
  decision_scope STRING,
  declared_benefit STRING,
  hidden_cost STRING,
  net_public_effect STRING,
  has_tradeoff BOOL,
  summary_matches_text STRING,
  risk_flags JSONB,
  critical_articles JSONB,
  analysis_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id STRING PRIMARY KEY,
  vote_date DATE,
  description STRING,
  summary STRING,
  url STRING,
  session_number STRING
);

CREATE TABLE IF NOT EXISTS vote_classifications (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  vote_id STRING NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  session_number STRING,
  classification STRING NOT NULL CHECK (classification IN ('positive_public_interest', 'neutral', 'low_relevance', 'negative_public_interest', 'harmful_or_self_serving')),
  severity STRING NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  public_interest_vote STRING NOT NULL CHECK (public_interest_vote IN ('yes', 'no', 'any', 'none')),
  confidence DECIMAL NOT NULL DEFAULT 0,
  reason STRING,
  source STRING NOT NULL DEFAULT 'rule' CHECK (source IN ('reviewed', 'rule', 'llm')),
  analysis_level INT4 NOT NULL DEFAULT 1 CHECK (analysis_level IN (1, 2, 3)),
  reviewed_manually BOOL NOT NULL DEFAULT false,
  methodology_version STRING,
  analysis_method_version STRING DEFAULT 'legislative-impact-v2',
  legislative_type STRING,
  decision_nature STRING,
  decision_scope STRING,
  vote_object_type STRING,
  vote_object_description STRING,
  yes_means STRING,
  no_means STRING,
  analyzed_text_matches_vote_object STRING,
  score_impact_limit STRING,
  is_procedural_vote BOOL,
  declared_benefit STRING,
  hidden_cost STRING,
  net_public_effect STRING,
  has_tradeoff BOOL,
  summary_matches_text STRING,
  risk_flags JSONB,
  critical_articles JSONB,
  analysis_payload JSONB,
  model_used STRING,
  model_role STRING,
  analysis_status STRING,
  risk_level STRING,
  needs_strong_review BOOL,
  review_reason STRING,
  coverage_category STRING,
  affects_score BOOL,
  score_safety_reason STRING,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vote_id, session_number)
);

CREATE TABLE IF NOT EXISTS legislator_votes (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  vote_id STRING NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  candidate_vote STRING NOT NULL CHECK (candidate_vote IN ('yes', 'no', 'abstain', 'absent')),
  score_delta DECIMAL NOT NULL DEFAULT 0,
  confidence DECIMAL,
  source STRING,
  reviewed_manually BOOL NOT NULL DEFAULT false,
  score_points DECIMAL,
  affects_score BOOL NOT NULL DEFAULT false,
  analysis_status STRING,
  needs_strong_review BOOL NOT NULL DEFAULT false,
  review_reason STRING,
  coverage_category STRING,
  score_safety_reason STRING,
  model_used STRING,
  model_role STRING
);

CREATE TABLE IF NOT EXISTS legislator_amendments (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  legislator_id INT8 NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id STRING NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  number STRING,
  year STRING,
  type STRING,
  beneficiary STRING,
  proposed_value DECIMAL,
  transferred_value DECIMAL
);

CREATE TABLE IF NOT EXISTS snapshot_metadata (
  id INT4 PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  generated_at TIMESTAMPTZ NOT NULL,
  timezone STRING NOT NULL DEFAULT 'America/Fortaleza',
  default_period STRING NOT NULL,
  data_coverage_percent DECIMAL DEFAULT 0,
  ai_classified_count INT4 DEFAULT 0,
  ai_total_count INT4 DEFAULT 0,
  ai_progress_percent DECIMAL DEFAULT 0,
  last_updated_at DATE,
  methodology_version STRING,
  reviewed_at DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  name STRING NOT NULL,
  url STRING NOT NULL,
  updated_at DATE
);

CREATE TABLE IF NOT EXISTS classification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target STRING NOT NULL CHECK (target IN ('votes', 'proposals', 'both')),
  analysis_level INT4 NOT NULL CHECK (analysis_level IN (2, 3)),
  scope STRING NOT NULL CHECK (scope IN ('improvable', 'overwrite')),
  limit_per_target INT4 NOT NULL,
  concurrency INT4 NOT NULL,
  post_process_mode STRING NOT NULL CHECK (post_process_mode IN ('classify_only', 'classify_and_recalculate', 'materialize_only')),
  provider STRING,
  model STRING,
  method_version STRING NOT NULL,
  status STRING NOT NULL CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  total_items INT4 NOT NULL DEFAULT 0,
  pending_count INT4 NOT NULL DEFAULT 0,
  processing_count INT4 NOT NULL DEFAULT 0,
  classified_count INT4 NOT NULL DEFAULT 0,
  failed_count INT4 NOT NULL DEFAULT 0,
  skipped_count INT4 NOT NULL DEFAULT 0,
  last_error STRING,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  strong_review_enabled BOOL NOT NULL DEFAULT false,
  strong_provider STRING,
  strong_model STRING,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classification_run_items (
  id INT8 PRIMARY KEY DEFAULT unique_rowid(),
  run_id UUID NOT NULL REFERENCES classification_runs(id) ON DELETE CASCADE,
  target STRING NOT NULL CHECK (target IN ('votes', 'proposals')),
  item_id STRING NOT NULL,
  item_label STRING,
  status STRING NOT NULL CHECK (status IN ('pending', 'processing', 'classified', 'failed', 'skipped')),
  attempts INT4 NOT NULL DEFAULT 0,
  error_kind STRING,
  error_message STRING,
  duration_ms INT4,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, target, item_id)
);

CREATE INDEX IF NOT EXISTS idx_legislators_chamber ON legislators(chamber);
CREATE INDEX IF NOT EXISTS idx_legislators_slug ON legislators(slug);
CREATE INDEX IF NOT EXISTS idx_legislator_period_metrics_legislator_period ON legislator_period_metrics(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_period_metrics_period ON legislator_period_metrics(period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_period_top_donors_lp ON legislator_period_top_donors(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_period_top_campaign_suppliers_lp ON legislator_period_top_campaign_suppliers(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_period_expense_categories_lp ON legislator_period_expense_categories(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_period_suppliers_lp ON legislator_period_suppliers(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_period_largest_expenses_lp ON legislator_period_largest_expenses(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_proposals_lp ON legislator_proposals(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_proposals_period ON legislator_proposals(period_id);
CREATE INDEX IF NOT EXISTS idx_proposal_classifications_proposal ON proposal_classifications(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_classifications_level ON proposal_classifications(analysis_level);
CREATE INDEX IF NOT EXISTS idx_proposal_classifications_net_effect ON proposal_classifications(net_public_effect);
CREATE INDEX IF NOT EXISTS idx_proposals_date ON proposals(proposal_date);
CREATE INDEX IF NOT EXISTS idx_legislator_votes_lp ON legislator_votes(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_votes_score_delta ON legislator_votes(score_delta);
CREATE INDEX IF NOT EXISTS idx_legislator_votes_analysis_status ON legislator_votes(analysis_status);
CREATE INDEX IF NOT EXISTS idx_legislator_votes_affects_score ON legislator_votes(affects_score);
CREATE INDEX IF NOT EXISTS idx_legislator_votes_vote_id_id ON legislator_votes(vote_id, id);
CREATE INDEX IF NOT EXISTS idx_legislator_votes_period_legislator_id ON legislator_votes(period_id, legislator_id);
CREATE INDEX IF NOT EXISTS idx_legislator_votes_legislator_period_id_desc ON legislator_votes(legislator_id, period_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_vote_classifications_vote ON vote_classifications(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_classifications_level ON vote_classifications(analysis_level);
CREATE INDEX IF NOT EXISTS idx_vote_classifications_object_type ON vote_classifications(vote_object_type);
CREATE INDEX IF NOT EXISTS idx_vote_classifications_net_effect ON vote_classifications(net_public_effect);
CREATE INDEX IF NOT EXISTS idx_vote_classifications_analysis_status ON vote_classifications(analysis_status);
CREATE INDEX IF NOT EXISTS idx_vote_classifications_needs_strong_review ON vote_classifications(needs_strong_review) WHERE needs_strong_review = true;
CREATE INDEX IF NOT EXISTS idx_vote_classifications_vote_id_id ON vote_classifications(vote_id, id);
CREATE INDEX IF NOT EXISTS idx_votes_date ON votes(vote_date);
CREATE INDEX IF NOT EXISTS idx_legislator_amendments_lp ON legislator_amendments(legislator_id, period_id);
CREATE INDEX IF NOT EXISTS idx_legislator_amendments_transferred ON legislator_amendments(legislator_id, period_id, transferred_value DESC);
CREATE INDEX IF NOT EXISTS idx_legislator_assets_legislator ON legislator_assets(legislator_id);
CREATE INDEX IF NOT EXISTS idx_legislator_staff_legislator ON legislator_staff(legislator_id);
CREATE INDEX IF NOT EXISTS idx_legislator_period_suppliers_total ON legislator_period_suppliers(legislator_id, period_id, total DESC);
CREATE INDEX IF NOT EXISTS idx_legislator_period_largest_expenses_value ON legislator_period_largest_expenses(legislator_id, period_id, value DESC);
CREATE INDEX IF NOT EXISTS idx_classification_runs_status_updated ON classification_runs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_classification_run_items_run_status ON classification_run_items(run_id, target, status, id);
