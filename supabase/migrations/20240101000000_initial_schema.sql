-- ============================================
-- Score Brasil - Supabase Schema
-- ============================================
-- Designed to support deputies, senators, and
-- future legislative chambers via the `chamber` field.
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

CREATE TABLE legislators (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  civil_name TEXT,
  photo_url TEXT,
  chamber_url TEXT,
  chamber TEXT NOT NULL DEFAULT 'camara' CHECK (chamber IN ('camara', 'senado')),
  election_number TEXT,
  tse_sequence TEXT,
  election_status TEXT,
  assets_total NUMERIC,
  assets_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE legislator_details (
  legislator_id BIGINT PRIMARY KEY REFERENCES legislators(id) ON DELETE CASCADE,
  birth_date DATE,
  birth_place TEXT,
  education TEXT,
  office TEXT
);

CREATE TABLE legislator_assets (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT,
  value NUMERIC NOT NULL
);

CREATE TABLE legislator_staff (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  start_date DATE
);

CREATE TABLE periods (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_partial BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================
-- PERIOD METRICS (the core ranking data)
-- ============================================

CREATE TABLE legislator_period_metrics (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  party TEXT NOT NULL,
  state TEXT NOT NULL,
  office_start DATE NOT NULL,
  office_end DATE NOT NULL,
  days_in_office INTEGER NOT NULL,
  months_in_office NUMERIC NOT NULL,
  plenary_attendances INTEGER,
  plenary_sessions_total INTEGER,
  nominal_votes INTEGER,
  nominal_votes_total INTEGER,
  substantive_proposals INTEGER,
  oversight_proposals INTEGER,
  advanced_proposals INTEGER,
  converted_proposals INTEGER,
  author_proposals INTEGER,
  coauthor_proposals INTEGER,
  requester_proposals INTEGER,
  fiscalization_proposals INTEGER,
  expenses_total NUMERIC,
  expense_documents INTEGER,
  supplier_concentration NUMERIC,
  campaign_candidacy_available BOOLEAN DEFAULT FALSE,
  assets_available BOOLEAN DEFAULT FALSE,
  total_votes INTEGER,
  total_campaign_receipts NUMERIC,
  total_public_receipts NUMERIC,
  total_campaign_expenses NUMERIC,
  public_contribution_points NUMERIC,
  public_classified_proposals INTEGER DEFAULT 0,
  public_total_proposals INTEGER DEFAULT 0,
  public_vote_positive_points NUMERIC DEFAULT 0,
  public_vote_negative_penalties NUMERIC DEFAULT 0,
  public_vote_absence_penalties NUMERIC DEFAULT 0,
  public_votes_analyzed INTEGER DEFAULT 0,
  public_vote_average_confidence NUMERIC,
  public_vote_score NUMERIC,
  UNIQUE(legislator_id, period_id)
);

-- ============================================
-- NESTED METRIC DETAILS (arrays flattened into related tables)
-- ============================================

CREATE TABLE legislator_period_top_donors (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL
);

CREATE TABLE legislator_period_top_campaign_suppliers (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL
);

CREATE TABLE legislator_period_expense_categories (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total NUMERIC NOT NULL,
  documents INTEGER NOT NULL
);

CREATE TABLE legislator_period_suppliers (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT,
  total NUMERIC NOT NULL,
  documents INTEGER NOT NULL
);

CREATE TABLE legislator_period_largest_expenses (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  supplier TEXT,
  expense_date DATE,
  value NUMERIC NOT NULL,
  document_url TEXT
);

-- ============================================
-- PROPOSALS (global, not per-deputy)
-- ============================================

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  type TEXT,
  number TEXT,
  year TEXT,
  proposal_date DATE,
  summary TEXT,
  status TEXT,
  url TEXT,
  chamber_url TEXT
);

CREATE TABLE legislator_proposals (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  participation_role TEXT NOT NULL,
  participation_label TEXT NOT NULL,
  proposal_nature TEXT NOT NULL,
  proposal_nature_label TEXT NOT NULL
);

CREATE TABLE proposal_classifications (
  proposal_id TEXT PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  justification TEXT,
  source TEXT NOT NULL DEFAULT 'rule' CHECK (source IN ('reviewed', 'rule', 'llm')),
  analysis_level INTEGER NOT NULL DEFAULT 1 CHECK (analysis_level IN (1, 2, 3)),
  methodology_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VOTES (global, not per-deputy)
-- ============================================

CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  vote_date DATE,
  description TEXT,
  summary TEXT,
  url TEXT,
  session_number TEXT
);

CREATE TABLE vote_classifications (
  id BIGSERIAL PRIMARY KEY,
  vote_id TEXT NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  session_number TEXT,
  classification TEXT NOT NULL CHECK (classification IN ('positive_public_interest', 'neutral', 'low_relevance', 'negative_public_interest', 'harmful_or_self_serving')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  public_interest_vote TEXT NOT NULL CHECK (public_interest_vote IN ('yes', 'no', 'any', 'none')),
  confidence NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'rule' CHECK (source IN ('reviewed', 'rule', 'llm')),
  analysis_level INTEGER NOT NULL DEFAULT 1 CHECK (analysis_level IN (1, 2, 3)),
  reviewed_manually BOOLEAN NOT NULL DEFAULT FALSE,
  methodology_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vote_id, session_number)
);

CREATE TABLE legislator_votes (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  vote_id TEXT NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  candidate_vote TEXT NOT NULL CHECK (candidate_vote IN ('yes', 'no', 'abstain', 'absent')),
  score_delta NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC,
  reason TEXT,
  source TEXT,
  reviewed_manually BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================
-- AMENDMENTS
-- ============================================

CREATE TABLE legislator_amendments (
  id BIGSERIAL PRIMARY KEY,
  legislator_id BIGINT NOT NULL REFERENCES legislators(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  number TEXT,
  year TEXT,
  type TEXT,
  beneficiary TEXT,
  proposed_value NUMERIC,
  transferred_value NUMERIC
);

-- ============================================
-- METADATA
-- ============================================

CREATE TABLE snapshot_metadata (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  generated_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
  default_period TEXT NOT NULL,
  data_coverage_percent NUMERIC DEFAULT 0,
  ai_classified_count INTEGER DEFAULT 0,
  ai_total_count INTEGER DEFAULT 0,
  ai_progress_percent NUMERIC DEFAULT 0,
  last_updated_at DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  updated_at DATE
);

-- ============================================
-- INDEXES FOR COMMON QUERIES
-- ============================================

CREATE INDEX idx_legislators_chamber ON legislators(chamber);
CREATE INDEX idx_legislators_slug ON legislators(slug);
CREATE INDEX idx_legislator_period_metrics_legislator_period ON legislator_period_metrics(legislator_id, period_id);
CREATE INDEX idx_legislator_period_metrics_period ON legislator_period_metrics(period_id);
CREATE INDEX idx_legislator_period_top_donors_lp ON legislator_period_top_donors(legislator_id, period_id);
CREATE INDEX idx_legislator_period_top_campaign_suppliers_lp ON legislator_period_top_campaign_suppliers(legislator_id, period_id);
CREATE INDEX idx_legislator_period_expense_categories_lp ON legislator_period_expense_categories(legislator_id, period_id);
CREATE INDEX idx_legislator_period_suppliers_lp ON legislator_period_suppliers(legislator_id, period_id);
CREATE INDEX idx_legislator_period_largest_expenses_lp ON legislator_period_largest_expenses(legislator_id, period_id);
CREATE INDEX idx_legislator_proposals_lp ON legislator_proposals(legislator_id, period_id);
CREATE INDEX idx_proposal_classifications_proposal ON proposal_classifications(proposal_id);
CREATE INDEX idx_proposal_classifications_level ON proposal_classifications(analysis_level);
CREATE INDEX idx_legislator_votes_lp ON legislator_votes(legislator_id, period_id);
CREATE INDEX idx_vote_classifications_vote ON vote_classifications(vote_id);
CREATE INDEX idx_vote_classifications_level ON vote_classifications(analysis_level);
CREATE INDEX idx_legislator_amendments_lp ON legislator_amendments(legislator_id, period_id);
CREATE INDEX idx_legislator_assets_legislator ON legislator_assets(legislator_id);
CREATE INDEX idx_legislator_staff_legislator ON legislator_staff(legislator_id);

-- ============================================
-- ROW LEVEL SECURITY (public read for frontend)
-- ============================================

ALTER TABLE legislators ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_period_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_period_top_donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_period_top_campaign_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_period_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_period_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_period_largest_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislator_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Public can read all data
CREATE POLICY "Public read access on legislators" ON legislators FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_details" ON legislator_details FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_assets" ON legislator_assets FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_staff" ON legislator_staff FOR SELECT USING (true);
CREATE POLICY "Public read access on periods" ON periods FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_period_metrics" ON legislator_period_metrics FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_period_top_donors" ON legislator_period_top_donors FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_period_top_campaign_suppliers" ON legislator_period_top_campaign_suppliers FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_period_expense_categories" ON legislator_period_expense_categories FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_period_suppliers" ON legislator_period_suppliers FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_period_largest_expenses" ON legislator_period_largest_expenses FOR SELECT USING (true);
CREATE POLICY "Public read access on proposals" ON proposals FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_proposals" ON legislator_proposals FOR SELECT USING (true);
CREATE POLICY "Public read access on proposal_classifications" ON proposal_classifications FOR SELECT USING (true);
CREATE POLICY "Public read access on votes" ON votes FOR SELECT USING (true);
CREATE POLICY "Public read access on vote_classifications" ON vote_classifications FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_votes" ON legislator_votes FOR SELECT USING (true);
CREATE POLICY "Public read access on legislator_amendments" ON legislator_amendments FOR SELECT USING (true);
CREATE POLICY "Public read access on snapshot_metadata" ON snapshot_metadata FOR SELECT USING (true);
CREATE POLICY "Public read access on sources" ON sources FOR SELECT USING (true);

-- Service role can do everything (used by pipeline)
CREATE POLICY "Service role full access on legislators" ON legislators FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_details" ON legislator_details FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_assets" ON legislator_assets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_staff" ON legislator_staff FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on periods" ON periods FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_period_metrics" ON legislator_period_metrics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_period_top_donors" ON legislator_period_top_donors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_period_top_campaign_suppliers" ON legislator_period_top_campaign_suppliers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_period_expense_categories" ON legislator_period_expense_categories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_period_suppliers" ON legislator_period_suppliers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_period_largest_expenses" ON legislator_period_largest_expenses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on proposals" ON proposals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_proposals" ON legislator_proposals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on proposal_classifications" ON proposal_classifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on votes" ON votes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on vote_classifications" ON vote_classifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_votes" ON legislator_votes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on legislator_amendments" ON legislator_amendments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on snapshot_metadata" ON snapshot_metadata FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on sources" ON sources FOR ALL USING (auth.role() = 'service_role');
