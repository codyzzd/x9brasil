export const PUBLIC_VALUE_WEIGHTS = {
  participation: 0.15,
  contribution: 0.30,
  publicVotes: 0.25,
  efficiency: 0.20,
  campaignFinance: 0.10,
} as const;

export type PublicValueDimensionKey = keyof typeof PUBLIC_VALUE_WEIGHTS;

export const PUBLIC_VALUE_DIMENSION_ORDER = [
  "participation",
  "contribution",
  "publicVotes",
  "efficiency",
  "campaignFinance",
] as const satisfies readonly PublicValueDimensionKey[];

export const PUBLIC_VALUE_DIMENSION_LABELS: Record<
  PublicValueDimensionKey,
  string
> = {
  participation: "Participação",
  contribution: "Produção",
  publicVotes: "Votos",
  efficiency: "Finanças",
  campaignFinance: "Campanha",
};

export const PUBLIC_VALUE_CATEGORIES = {
  anti_corruption: { label: "Combate à corrupção", weight: 10 },
  public_transparency: { label: "Transparência pública", weight: 10 },
  waste_reduction: { label: "Redução de desperdício público", weight: 10 },
  health: { label: "Saúde", weight: 8 },
  education: { label: "Educação", weight: 8 },
  security: { label: "Segurança", weight: 8 },
  infrastructure: { label: "Infraestrutura", weight: 8 },
  jobs_economy: { label: "Emprego e economia", weight: 8 },
  state_modernization: { label: "Modernização do Estado", weight: 6 },
  technology_innovation: { label: "Tecnologia e inovação", weight: 6 },
  deregulation: { label: "Desburocratização", weight: 6 },
  tribute: { label: "Homenagem ou título honorífico", weight: 1 },
  commemorative_date: { label: "Data comemorativa", weight: 1 },
  motion: { label: "Moção", weight: 1 },
  place_naming: { label: "Denominação de bem público", weight: 1 },
} as const;

export type PublicValueCategory = keyof typeof PUBLIC_VALUE_CATEGORIES;
export type ClassificationConfidence = "high" | "medium" | "low";
export type ClassificationSource = "reviewed" | "rule" | "llm";
export type ProposalStage = "presented" | "advanced" | "converted";

export type ParticipationRole = "AUTHOR" | "COAUTHOR" | "REQUESTER" | "FISCALIZATION" | "SIGNATORY" | "UNKNOWN";
export type ProposalNature = "SUBSTANTIVE" | "FISCALIZATION" | "PROCEDURAL" | "SYMBOLIC" | "UNKNOWN";

export const ROLE_WEIGHTS = {
  AUTHOR: 1.00,
  COAUTHOR: 0.45,
  REQUESTER: 0.60,
  FISCALIZATION: 0.55,
  SIGNATORY: 0.20,
  UNKNOWN: 0.05,
} as const;

export const NATURE_WEIGHTS = {
  SUBSTANTIVE: 1.00,
  FISCALIZATION: 0.65,
  PROCEDURAL: 0.25,
  SYMBOLIC: 0.10,
  UNKNOWN: 0.05,
} as const;

export const PROGRESS_BONUS = {
  ADVANCED: 0.20,
  BECAME_NORM: 0.50,
} as const;

export const PARTICIPATION_LABELS: Record<ParticipationRole, string> = {
  AUTHOR: "Autoria principal",
  COAUTHOR: "Coautoria",
  REQUESTER: "Requerente",
  FISCALIZATION: "Fiscalização",
  SIGNATORY: "Signatário",
  UNKNOWN: "Não identificado",
};

export const NATURE_LABELS: Record<ProposalNature, string> = {
  SUBSTANTIVE: "Proposta substantiva",
  FISCALIZATION: "Fiscalização",
  PROCEDURAL: "Procedimental",
  SYMBOLIC: "Simbólica",
  UNKNOWN: "Não classificada",
};

export type PublicVoteClassification =
  | "positive_public_interest"
  | "neutral"
  | "low_relevance"
  | "negative_public_interest"
  | "harmful_or_self_serving";
export type PublicVoteSeverity = "low" | "medium" | "high" | "critical";
export type CandidateVote = "yes" | "no" | "abstain" | "absent";
export type PublicInterestVote = "yes" | "no" | "any" | "none" | "indeterminate";
export type LegislativeType =
  | "PL"
  | "PLP"
  | "PEC"
  | "PDL"
  | "PRC"
  | "MPV"
  | "RIC"
  | "PFC"
  | "REQ"
  | "EMP"
  | "SBT"
  | "DTQ"
  | "VTS"
  | "RCP"
  | "MSC"
  | "INC"
  | "OUTRO"
  | "INCERTO";
export type VoteObjectType =
  | "main_bill"
  | "amendment"
  | "substitute"
  | "highlight"
  | "separate_vote"
  | "urgency"
  | "procedural_request"
  | "postponement"
  | "agenda_withdrawal"
  | "appeal"
  | "symbolic"
  | "fiscalization"
  | "other"
  | "unclear";
export type DecisionNature =
  | "substantive_policy"
  | "constitutional_change"
  | "fiscal_budgetary"
  | "oversight_control"
  | "information_request"
  | "criminal_penalty"
  | "rights_expansion"
  | "rights_restriction"
  | "institutional_rule"
  | "symbolic"
  | "commemorative"
  | "procedural"
  | "unclear";
export type DecisionScope =
  | "national_policy"
  | "constitutional_rule"
  | "fiscal_effect"
  | "criminal_law"
  | "administrative_control"
  | "congressional_procedure"
  | "oversight"
  | "symbolic_only"
  | "local_or_specific"
  | "unclear";
export type NetPublicEffect = "positive" | "negative" | "mixed" | "neutral" | "unclear" | "insufficient";
export type SummaryMatchesText = "true" | "false" | "unclear";
export type ScoreImpactLimit = "none" | "low" | "medium" | "high" | "critical";
export type VoteObjectSubtype = "amendment" | "substitute" | "main_bill" | "request" | "none" | "unclear";
export type PrimaryTextUsed = "vote_object" | "related_bill" | "summary_only" | "unknown";
export type ModelRecommendation = "strong_model_required" | "mini_allowed_for_triage";
export type ModelRole = "triage" | "strong_review" | "rules_only";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type AnalysisStatus =
  | "validated"
  | "neutral_validated"
  | "pending_strong_review"
  | "insufficient_data"
  | "mixed_requires_review"
  | "procedural_low_confidence"
  | "not_eligible"
  | "failed_parsing";
export type CoverageCategory = "scored" | "neutral_analyzed" | "pending_review" | "insufficient" | "not_eligible";
export type RiskFlag =
  | "benefit_offset_by_hidden_cost"
  | "hidden_revocation"
  | "scope_mismatch"
  | "unrelated_amendment"
  | "jabuti"
  | "privilege_or_benefit"
  | "corporate_or_category_benefit"
  | "economic_group_benefit"
  | "fiscal_impact"
  | "transparency_reduction"
  | "oversight_reduction"
  | "constitutional_risk"
  | "increased_workload"
  | "increased_cost_or_tax"
  | "increased_bureaucracy"
  | "reduced_rights"
  | "procedural_only"
  | "vote_object_unclear"
  | "text_does_not_match_vote_object"
  | "insufficient_vote_object_text"
  | "hidden_exception"
  | "sector_specific_benefit"
  | "insufficient_text"
  | "none";
export type CriticalArticle = {
  article: string;
  issue: string;
  appearsInVoteObjectText?: boolean;
};

export type ProposalClassification = {
  category: PublicValueCategory;
  confidence: ClassificationConfidence;
  justification: string;
  source: ClassificationSource;
  analysisLevel: 1 | 2 | 3;
  methodologyVersion: string;
  analysisMethodVersion?: string;
  legislativeType?: LegislativeType;
  decisionNature?: DecisionNature;
  decisionScope?: DecisionScope;
  declaredBenefit?: string;
  hiddenCost?: string;
  netPublicEffect?: NetPublicEffect;
  hasTradeoff?: boolean;
  summaryMatchesText?: SummaryMatchesText;
  riskFlags?: RiskFlag[];
  criticalArticles?: CriticalArticle[];
  analysisPayload?: Record<string, unknown>;
};

export const METHODOLOGY_VERSION = "legislative-impact-v2";
export const METHODOLOGY_REVIEWED_AT = "2026-06-19";
export const LEGISLATIVE_IMPACT_V3_VERSION = "legislative-impact-v3-strong-model";
export const LEGISLATIVE_IMPACT_V4_VERSION = "legislative-impact-v4-mini-first-safe-score";
export const MINI_SAFE_SCORE_CONFIG = {
  useStrongModelReview: false,
  allowMiniHighRiskScoring: false,
  minConfidenceToScoreWithMini: 0.85,
  minConfidenceToApplyAnyScore: 0.7,
  maxMiniScoreImpact: 12,
  maxMiniSpecificObjectImpact: 8,
  maxMiniProceduralImpact: 2,
  maxMiniMixedImpact: 0,
} as const;

export type PublicVoteAnalysis = {
  voteId: string;
  classification: PublicVoteClassification;
  severity: PublicVoteSeverity;
  publicInterestVote: PublicInterestVote;
  confidence: number;
  isProceduralVote?: boolean;
  legislativeType?: LegislativeType;
  decisionNature?: DecisionNature;
  decisionScope?: DecisionScope;
  voteObjectType?: VoteObjectType;
  voteObjectSubtype?: VoteObjectSubtype;
  voteObjectDescription?: string;
  yesMeans?: string;
  noMeans?: string;
  voteObjectTextFound?: boolean;
  primaryTextUsed?: PrimaryTextUsed;
  usedRelatedBillAsMainEvidence?: boolean;
  analyzedTextMatchesVoteObject?: SummaryMatchesText;
  scoreImpactLimit?: ScoreImpactLimit;
  recommendedScoreImpact?: number;
  scoreSafetyReason?: string;
  modelRecommendation?: ModelRecommendation;
  modelUsed?: string;
  modelRole?: ModelRole;
  riskLevel?: RiskLevel;
  analysisStatus?: AnalysisStatus;
  affectsScore?: boolean;
  scorePoints?: number | null;
  needsStrongReview?: boolean;
  reviewReason?: string;
  coverageCategory?: CoverageCategory;
  declaredBenefit?: string;
  hiddenCost?: string;
  netPublicEffect?: NetPublicEffect;
  hasTradeoff?: boolean;
  summaryMatchesText?: SummaryMatchesText;
  riskFlags?: RiskFlag[];
  criticalArticles?: CriticalArticle[];
  reason: string;
  source: ClassificationSource;
  analysisLevel: 1 | 2 | 3;
  reviewedManually: boolean;
  methodologyVersion: string;
  analysisMethodVersion?: string;
  analysisPayload?: Record<string, unknown>;
};

export type PublicVoteRecord = {
  voteId: string;
  candidateId: string;
  candidateVote: CandidateVote;
  classification: PublicVoteClassification;
  severity: PublicVoteSeverity;
  scoreDelta: number;
  scorePoints?: number | null;
  affectsScore?: boolean;
  analysisStatus?: AnalysisStatus;
  needsStrongReview?: boolean;
  reviewReason?: string;
  coverageCategory?: CoverageCategory;
  scoreSafetyReason?: string;
  modelUsed?: string;
  modelRole?: ModelRole;
  confidence: number;
  reason: string;
  source: string;
  reviewedManually: boolean;
};

export const VOTE_METHODOLOGY_VERSION = LEGISLATIVE_IMPACT_V4_VERSION;

const PUBLIC_VOTE_CLASSIFICATIONS = [
  "positive_public_interest",
  "neutral",
  "low_relevance",
  "negative_public_interest",
  "harmful_or_self_serving",
] as const satisfies readonly PublicVoteClassification[];
const PUBLIC_VOTE_SEVERITIES = ["low", "medium", "high", "critical"] as const satisfies readonly PublicVoteSeverity[];
const PUBLIC_INTEREST_VOTES = ["yes", "no", "any", "none", "indeterminate"] as const satisfies readonly PublicInterestVote[];
const LEGISLATIVE_TYPES = [
  "PL",
  "PLP",
  "PEC",
  "PDL",
  "PRC",
  "MPV",
  "RIC",
  "PFC",
  "REQ",
  "EMP",
  "SBT",
  "DTQ",
  "VTS",
  "RCP",
  "MSC",
  "INC",
  "OUTRO",
  "INCERTO",
] as const satisfies readonly LegislativeType[];
const VOTE_OBJECT_TYPES = [
  "main_bill",
  "amendment",
  "substitute",
  "highlight",
  "separate_vote",
  "urgency",
  "procedural_request",
  "postponement",
  "agenda_withdrawal",
  "appeal",
  "symbolic",
  "fiscalization",
  "other",
  "unclear",
] as const satisfies readonly VoteObjectType[];
const DECISION_NATURES = [
  "substantive_policy",
  "constitutional_change",
  "fiscal_budgetary",
  "oversight_control",
  "information_request",
  "criminal_penalty",
  "rights_expansion",
  "rights_restriction",
  "institutional_rule",
  "symbolic",
  "commemorative",
  "procedural",
  "unclear",
] as const satisfies readonly DecisionNature[];
const DECISION_SCOPES = [
  "national_policy",
  "constitutional_rule",
  "fiscal_effect",
  "criminal_law",
  "administrative_control",
  "congressional_procedure",
  "oversight",
  "symbolic_only",
  "local_or_specific",
  "unclear",
] as const satisfies readonly DecisionScope[];
const NET_PUBLIC_EFFECTS = ["positive", "negative", "mixed", "neutral", "unclear", "insufficient"] as const satisfies readonly NetPublicEffect[];
const SUMMARY_MATCHES_TEXT = ["true", "false", "unclear"] as const satisfies readonly SummaryMatchesText[];
const SCORE_IMPACT_LIMITS = ["none", "low", "medium", "high", "critical"] as const satisfies readonly ScoreImpactLimit[];
const VOTE_OBJECT_SUBTYPES = ["amendment", "substitute", "main_bill", "request", "none", "unclear"] as const satisfies readonly VoteObjectSubtype[];
const PRIMARY_TEXT_USED = ["vote_object", "related_bill", "summary_only", "unknown"] as const satisfies readonly PrimaryTextUsed[];
const MODEL_RECOMMENDATIONS = ["strong_model_required", "mini_allowed_for_triage"] as const satisfies readonly ModelRecommendation[];
const MODEL_ROLES = ["triage", "strong_review", "rules_only"] as const satisfies readonly ModelRole[];
const RISK_LEVELS = ["low", "medium", "high", "critical"] as const satisfies readonly RiskLevel[];
const ANALYSIS_STATUSES = [
  "validated",
  "neutral_validated",
  "pending_strong_review",
  "insufficient_data",
  "mixed_requires_review",
  "procedural_low_confidence",
  "not_eligible",
  "failed_parsing",
] as const satisfies readonly AnalysisStatus[];
const COVERAGE_CATEGORIES = ["scored", "neutral_analyzed", "pending_review", "insufficient", "not_eligible"] as const satisfies readonly CoverageCategory[];
const RISK_FLAGS = [
  "benefit_offset_by_hidden_cost",
  "hidden_revocation",
  "scope_mismatch",
  "unrelated_amendment",
  "jabuti",
  "privilege_or_benefit",
  "corporate_or_category_benefit",
  "economic_group_benefit",
  "fiscal_impact",
  "transparency_reduction",
  "oversight_reduction",
  "constitutional_risk",
  "increased_workload",
  "increased_cost_or_tax",
  "increased_bureaucracy",
  "reduced_rights",
  "procedural_only",
  "vote_object_unclear",
  "text_does_not_match_vote_object",
  "insufficient_vote_object_text",
  "hidden_exception",
  "sector_specific_benefit",
  "insufficient_text",
  "none",
] as const satisfies readonly RiskFlag[];

const rules: Array<{
  category: PublicValueCategory;
  patterns: RegExp[];
  justification: string;
}> = [
  {
    category: "tribute",
    patterns: [
      /\bconcede\b.*\bmedalha\b/,
      /\bconcede\b.*\btitulo\b/,
      /\btitulo honorifico\b/,
      /\bhomenageia\b/,
    ],
    justification: "A ementa caracteriza homenagem ou concessão de título.",
  },
  {
    category: "commemorative_date",
    patterns: [/\binstitui\b.*\bdia (nacional|oficial|estadual|municipal)\b/, /\bsemana nacional\b/],
    justification: "A ementa institui data ou período comemorativo.",
  },
  {
    category: "place_naming",
    patterns: [/\bdenomina\b/, /\bda o nome de\b/, /\bdesigna\b.*\b(aeroporto|rodovia|ponte|predio)\b/],
    justification: "A ementa denomina bem, obra ou espaço público.",
  },
  {
    category: "motion",
    patterns: [/\bmocao\b/, /\bvoto de (louvor|pesar|repudio)\b/],
    justification: "A ementa apresenta moção ou voto simbólico.",
  },
  {
    category: "anti_corruption",
    patterns: [/\bcorrupcao\b/, /\bimprobidade\b/, /\benriquecimento ilicito\b/, /\blavagem de dinheiro\b/],
    justification: "A ementa trata diretamente de corrupção ou integridade pública.",
  },
  {
    category: "public_transparency",
    patterns: [/\btransparencia\b/, /\bacesso a informacao\b/, /\bdados abertos\b/, /\bprestacao de contas\b/],
    justification: "A ementa trata de transparência, acesso à informação ou prestação de contas.",
  },
  {
    category: "waste_reduction",
    patterns: [/\bdesperdicio\b/, /\bgasto publico\b/, /\bdespesa publica\b/, /\beconomia de recursos\b/],
    justification: "A ementa trata explicitamente de gasto ou desperdício público.",
  },
  {
    category: "health",
    patterns: [/\bsaude\b/, /\bsus\b/, /\bmedicamento\b/, /\bhospital\b/, /\bdoenca\b/, /\bvacina\b/],
    justification: "A ementa trata diretamente de saúde pública.",
  },
  {
    category: "education",
    patterns: [/\beducacao\b/, /\bescola\b/, /\bensino\b/, /\buniversidade\b/, /\bprofessor\b/, /\bestudante\b/],
    justification: "A ementa trata diretamente de educação.",
  },
  {
    category: "security",
    patterns: [/\bseguranca publica\b/, /\bpolicia\b/, /\bcrime\b/, /\bcriminal\b/, /\bviolencia\b/, /\bpenal\b/],
    justification: "A ementa trata diretamente de segurança pública ou política criminal.",
  },
  {
    category: "infrastructure",
    patterns: [/\binfraestrutura\b/, /\bsaneamento\b/, /\brodovia\b/, /\bferrovia\b/, /\btransporte publico\b/, /\bhabitacao\b/],
    justification: "A ementa trata diretamente de infraestrutura ou serviços urbanos.",
  },
  {
    category: "jobs_economy",
    patterns: [/\bemprego\b/, /\btrabalho\b/, /\beconomia\b/, /\btribut/, /\bimposto\b/, /\bempresa\b/, /\bcredito\b/, /\brenda\b/],
    justification: "A ementa trata diretamente de emprego, renda, empresas ou política econômica.",
  },
  {
    category: "technology_innovation",
    patterns: [/\btecnologia\b/, /\binovacao\b/, /\bdigital\b/, /\binteligencia artificial\b/, /\bsoftware\b/, /\binternet\b/],
    justification: "A ementa trata diretamente de tecnologia ou inovação.",
  },
  {
    category: "deregulation",
    patterns: [/\bdesburocrat/, /\bsimplific/, /\blicenciamento\b/, /\bdispensa de\b.*\bautorizacao\b/],
    justification: "A ementa trata de simplificação regulatória ou administrativa.",
  },
  {
    category: "state_modernization",
    patterns: [/\badministracao publica\b/, /\bservico publico\b/, /\bgestao publica\b/, /\bgoverno digital\b/],
    justification: "A ementa trata de modernização da administração pública.",
  },
];

export function normalizeProposalText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function normalizePublicVote(value: string | null | undefined): CandidateVote {
  const normalized = normalizeProposalText(value || "");
  if (normalized === "sim") return "yes";
  if (normalized === "nao") return "no";
  if (normalized.includes("abstencao") || normalized.includes("obstrucao")) {
    return "abstain";
  }
  return "abstain";
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeRiskFlags(value: unknown): RiskFlag[] {
  if (!Array.isArray(value)) return ["none"];
  const flags = value.filter((flag): flag is RiskFlag =>
    typeof flag === "string" && (RISK_FLAGS as readonly string[]).includes(flag),
  );
  return flags.length > 0 ? flags : ["none"];
}

function normalizeCriticalArticles(value: unknown): CriticalArticle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const article = textValue(record.article).trim();
    const issue = textValue(record.issue).trim();
    if (!article || !issue) return [];
    return [{
      article,
      issue,
      appearsInVoteObjectText: typeof record.appearsInVoteObjectText === "boolean"
        ? record.appearsInVoteObjectText
        : undefined,
    }];
  });
}

export function inferLegislativeType(value: string | null | undefined): LegislativeType {
  const normalized = normalizeProposalText(value || "").toUpperCase();
  if (/\bPLP\b|PROJETO DE LEI COMPLEMENTAR/.test(normalized)) return "PLP";
  if (/\bPEC\b|PROPOSTA DE EMENDA A CONSTITUICAO/.test(normalized)) return "PEC";
  if (/\bPDL\b|PROJETO DE DECRETO LEGISLATIVO/.test(normalized)) return "PDL";
  if (/\bPRC\b|PROJETO DE RESOLUCAO/.test(normalized)) return "PRC";
  if (/\bMPV\b|MEDIDA PROVISORIA/.test(normalized)) return "MPV";
  if (/\bRIC\b|REQUERIMENTO DE INFORMACAO/.test(normalized)) return "RIC";
  if (/\bPFC\b|PROPOSTA DE FISCALIZACAO/.test(normalized)) return "PFC";
  if (/\bREQ\b|REQUERIMENTO/.test(normalized)) return "REQ";
  if (/\bEMP\b|EMENDA/.test(normalized)) return "EMP";
  if (/\bSBT\b|SUBSTITUTIVO/.test(normalized)) return "SBT";
  if (/\bDTQ\b|DESTAQUE/.test(normalized)) return "DTQ";
  if (/\bVTS\b|VOTACAO EM SEPARADO/.test(normalized)) return "VTS";
  if (/\bRCP\b|COMISSAO PARLAMENTAR/.test(normalized)) return "RCP";
  if (/\bMSC\b|MENSAGEM/.test(normalized)) return "MSC";
  if (/\bINC\b|INDICACAO/.test(normalized)) return "INC";
  if (/\bPL\b|PROJETO DE LEI/.test(normalized)) return "PL";
  return normalized ? "OUTRO" : "INCERTO";
}

export function inferVoteObjectType(description: string | null | undefined): VoteObjectType {
  const text = normalizeProposalText(description || "");
  if (!text) return "unclear";
  if (/\burgencia\b|regime de urgencia/.test(text)) return "urgency";
  if (/\bretirada de pauta\b|retirar de pauta/.test(text)) return "agenda_withdrawal";
  if (/\bdestaque\b|\bdtq\b/.test(text)) return "highlight";
  if (/\bvotacao em separado\b|\bvts\b/.test(text)) return "separate_vote";
  if (/\bemenda\b|\bemp\b/.test(text)) return "amendment";
  if (/\bsubstitutivo\b|\bsbt\b/.test(text)) return "substitute";
  if (/\badiamento\b|adiar\b/.test(text)) return "postponement";
  if (/\brecurso\b/.test(text)) return "appeal";
  if (/\brequerimento\b|\breq\b/.test(text)) return "procedural_request";
  if (/\binformacao\b|\bconvocacao\b|\baudiencia publica\b|\bfiscalizacao\b/.test(text)) return "fiscalization";
  if (/\bmocao\b|\bhomenagem\b|\bsessao solene\b|\baplausos\b|\brepudio\b/.test(text)) return "symbolic";
  if (/\baprovacao\b|\bapreciacao\b|\bvotacao nominal\b|\bmerito\b|\bprojeto\b/.test(text)) return "main_bill";
  return "unclear";
}

export function inferVoteObjectSubtype(description: string | null | undefined): VoteObjectSubtype {
  const text = normalizeProposalText(description || "");
  if (!text) return "unclear";
  if (/\bemenda\b|\bemp\b/.test(text)) return "amendment";
  if (/\bsubstitutivo\b|\bsbt\b/.test(text)) return "substitute";
  if (/\brequerimento\b|\breq\b/.test(text)) return "request";
  if (/\bprojeto\b|\bpl\b|\bpec\b|\bplp\b/.test(text)) return "main_bill";
  return "none";
}

export function normalizeProposalAnalysis(raw: ProposalClassification): ProposalClassification {
  const payload = raw.analysisPayload ?? { ...raw };
  return {
    ...raw,
    analysisMethodVersion: textValue(raw.analysisMethodVersion, METHODOLOGY_VERSION),
    legislativeType: enumValue(raw.legislativeType, LEGISLATIVE_TYPES, "INCERTO"),
    decisionNature: enumValue(raw.decisionNature, DECISION_NATURES, "unclear"),
    decisionScope: enumValue(raw.decisionScope, DECISION_SCOPES, "unclear"),
    declaredBenefit: textValue(raw.declaredBenefit),
    hiddenCost: textValue(raw.hiddenCost),
    netPublicEffect: enumValue(raw.netPublicEffect, NET_PUBLIC_EFFECTS, "unclear"),
    hasTradeoff: booleanValue(raw.hasTradeoff),
    summaryMatchesText: enumValue(raw.summaryMatchesText, SUMMARY_MATCHES_TEXT, "unclear"),
    riskFlags: normalizeRiskFlags(raw.riskFlags),
    criticalArticles: normalizeCriticalArticles(raw.criticalArticles),
    analysisPayload: payload,
  };
}

export function normalizeVoteAnalysis(raw: PublicVoteAnalysis): PublicVoteAnalysis {
  const confidence = Math.min(1, Math.max(0, Number(raw.confidence ?? 0.4)));
  const payload = raw.analysisPayload ?? { ...raw };
  return {
    ...raw,
    classification: enumValue(raw.classification, PUBLIC_VOTE_CLASSIFICATIONS, "neutral"),
    severity: enumValue(raw.severity, PUBLIC_VOTE_SEVERITIES, "low"),
    publicInterestVote: enumValue(raw.publicInterestVote, PUBLIC_INTEREST_VOTES, "none"),
    confidence: Number.isFinite(confidence) ? confidence : 0.4,
    isProceduralVote: booleanValue(raw.isProceduralVote),
    legislativeType: enumValue(raw.legislativeType, LEGISLATIVE_TYPES, "INCERTO"),
    decisionNature: enumValue(raw.decisionNature, DECISION_NATURES, "unclear"),
    decisionScope: enumValue(raw.decisionScope, DECISION_SCOPES, "unclear"),
    voteObjectType: enumValue(raw.voteObjectType, VOTE_OBJECT_TYPES, "unclear"),
    voteObjectSubtype: enumValue(raw.voteObjectSubtype, VOTE_OBJECT_SUBTYPES, "unclear"),
    voteObjectDescription: textValue(raw.voteObjectDescription),
    yesMeans: textValue(raw.yesMeans),
    noMeans: textValue(raw.noMeans),
    voteObjectTextFound: booleanValue(raw.voteObjectTextFound),
    primaryTextUsed: enumValue(raw.primaryTextUsed, PRIMARY_TEXT_USED, "unknown"),
    usedRelatedBillAsMainEvidence: booleanValue(raw.usedRelatedBillAsMainEvidence),
    analyzedTextMatchesVoteObject: enumValue(raw.analyzedTextMatchesVoteObject, SUMMARY_MATCHES_TEXT, "unclear"),
    scoreImpactLimit: enumValue(raw.scoreImpactLimit, SCORE_IMPACT_LIMITS, "low"),
    recommendedScoreImpact: numberValue(raw.recommendedScoreImpact),
    scoreSafetyReason: textValue(raw.scoreSafetyReason),
    modelRecommendation: enumValue(raw.modelRecommendation, MODEL_RECOMMENDATIONS, "mini_allowed_for_triage"),
    modelUsed: textValue(raw.modelUsed),
    modelRole: enumValue(raw.modelRole, MODEL_ROLES, "triage"),
    riskLevel: enumValue(raw.riskLevel, RISK_LEVELS, "low"),
    analysisStatus: enumValue(raw.analysisStatus, ANALYSIS_STATUSES, "validated"),
    affectsScore: booleanValue(raw.affectsScore, true),
    scorePoints: raw.scorePoints === null ? null : numberValue(raw.scorePoints),
    needsStrongReview: booleanValue(raw.needsStrongReview),
    reviewReason: textValue(raw.reviewReason),
    coverageCategory: enumValue(raw.coverageCategory, COVERAGE_CATEGORIES, "scored"),
    declaredBenefit: textValue(raw.declaredBenefit),
    hiddenCost: textValue(raw.hiddenCost),
    netPublicEffect: enumValue(raw.netPublicEffect, NET_PUBLIC_EFFECTS, "unclear"),
    hasTradeoff: booleanValue(raw.hasTradeoff),
    summaryMatchesText: enumValue(raw.summaryMatchesText, SUMMARY_MATCHES_TEXT, "unclear"),
    riskFlags: normalizeRiskFlags(raw.riskFlags),
    criticalArticles: normalizeCriticalArticles(raw.criticalArticles),
    reason: textValue(raw.reason, "Análise limitada por falta de dados suficientes."),
    analysisMethodVersion: textValue(raw.analysisMethodVersion, VOTE_METHODOLOGY_VERSION),
    analysisPayload: payload,
  };
}

export function classifyProposal(
  proposalId: string,
  summary: string,
): ProposalClassification | null {
  const normalized = normalizeProposalText(summary);
  const matches = rules.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(normalized)),
  );
  if (matches.length !== 1) return null;

  return {
    category: matches[0].category,
    confidence: "high",
    justification: matches[0].justification,
    source: "rule",
    analysisLevel: 1,
    methodologyVersion: METHODOLOGY_VERSION,
  };
}

export function proposalStageMultiplier(stage: ProposalStage) {
  if (stage === "converted") return 1;
  if (stage === "advanced") return 0.75;
  return 0.25;
}

export function proposalContributionPoints(
  classification: ProposalClassification,
  stage: ProposalStage,
) {
  return (
    PUBLIC_VALUE_CATEGORIES[classification.category].weight *
    proposalStageMultiplier(stage)
  );
}

export function getProposalWeight(params: {
  categoryWeight: number;
  stageMultiplier: number;
  role: ParticipationRole;
  nature: ProposalNature;
  stage: ProposalStage;
}) {
  const basePoints = params.categoryWeight * params.stageMultiplier;
  const roleWeight = ROLE_WEIGHTS[params.role];
  const natureWeight = NATURE_WEIGHTS[params.nature];
  const progressBonus =
    params.stage === "converted"
      ? PROGRESS_BONUS.BECAME_NORM
      : params.stage === "advanced"
        ? PROGRESS_BONUS.ADVANCED
        : 0;

  return basePoints * roleWeight * natureWeight + progressBonus;
}

export function formatScoreExplanation(params: {
  role: ParticipationRole;
  nature: ProposalNature;
  stage: ProposalStage;
}) {
  const roleLabel = PARTICIPATION_LABELS[params.role];
  const natureLabel = NATURE_LABELS[params.nature];
  return `Papel: ${roleLabel} × ${natureLabel}`;
}

export function publicValueClassificationMetadata() {
  return {
    methodologyVersion: METHODOLOGY_VERSION,
    reviewedAt: METHODOLOGY_REVIEWED_AT,
  };
}

export function classifyPublicVote(
  voteId: string,
  description: string,
  summary: string,
): PublicVoteAnalysis | null {
  const text = normalizeProposalText(`${description} ${summary}`);
  if (matchesAny(text, [/\bhomenagem\b/, /\bhomenageia\b/, /\bmedalha\b/, /\btitulo honorifico\b/, /\bdenomina\b/])) {
    return publicVoteRule(voteId, {
      classification: "low_relevance",
      severity: "low",
      publicInterestVote: "none",
      confidence: 0.75,
      reason:
        "A votação trata de homenagem, denominação ou ato simbólico, com baixo impacto prático direto para a população.",
    });
  }

  if (
    matchesAny(text, [
      /\baumenta\b.*\b(salario|subsidio|verba|beneficio|cotao|cota parlamentar)\b/,
      /\breajusta\b.*\b(salario|subsidio|verba|beneficio|cotao|cota parlamentar)\b/,
      /\bamplia\b.*\b(verba|beneficio|cotao|cota parlamentar)\b/,
      /\bprivilegio\b.*\b(parlamentar|politico|partido)\b/,
    ])
  ) {
    return publicVoteRule(voteId, {
      classification: "harmful_or_self_serving",
      severity: "critical",
      publicInterestVote: "no",
      confidence: 0.9,
      reason:
        "A votação aparenta ampliar custo ou benefício direto para parlamentares, partidos ou a própria classe política, sem benefício público claro.",
    });
  }

  if (
    matchesAny(text, [
      /\breduz\b.*\b(transparencia|acesso a informacao|prestacao de contas|fiscalizacao|controle)\b/,
      /\brestringe\b.*\b(transparencia|acesso a informacao|prestacao de contas|fiscalizacao|controle)\b/,
      /\bsigilo\b.*\b(publico|dados|informacao|prestacao de contas)\b/,
    ])
  ) {
    return publicVoteRule(voteId, {
      classification: "negative_public_interest",
      severity: "high",
      publicInterestVote: "no",
      confidence: 0.85,
      reason:
        "A votação indica redução de transparência, acesso à informação, prestação de contas ou fiscalização pública.",
    });
  }

  if (
    matchesAny(text, [
      /\btransparencia\b/,
      /\bacesso a informacao\b/,
      /\bdados abertos\b/,
      /\bprestacao de contas\b/,
      /\bfiscalizacao\b/,
      /\bcontrole externo\b/,
      /\bcombate a corrupcao\b/,
      /\bimprobidade\b/,
    ])
  ) {
    return publicVoteRule(voteId, {
      classification: "positive_public_interest",
      severity: "high",
      publicInterestVote: "yes",
      confidence: 0.8,
      reason:
        "A votação trata de transparência, prestação de contas, fiscalização ou integridade pública, critérios objetivos de interesse público.",
    });
  }

  if (
    matchesAny(text, [
      /\bdesburocrat/,
      /\bsimplific/,
      /\bservico publico\b/,
      /\bsaude\b/,
      /\beducacao\b/,
      /\bseguranca publica\b/,
      /\btransporte publico\b/,
      /\bsaneamento\b/,
    ])
  ) {
    return publicVoteRule(voteId, {
      classification: "positive_public_interest",
      severity: "medium",
      publicInterestVote: "yes",
      confidence: 0.7,
      reason:
        "A votação trata de simplificação, serviço essencial ou política pública de alcance social relevante.",
    });
  }

  return null;
}

export function publicVoteScoreDelta(
  analysis: PublicVoteAnalysis,
  candidateVote: CandidateVote,
) {
  return publicVoteScoreDecision(analysis, candidateVote).scoreDelta;
}

export function publicVoteScoreDecision(
  analysis: PublicVoteAnalysis,
  candidateVote: CandidateVote,
) {
  const normalized = normalizeVoteAnalysis(analysis);
  if (shouldPendingVoteScore(normalized)) {
    return pendingVoteDecision(normalized, choosePendingStatus(normalized), normalized.reviewReason || normalized.scoreSafetyReason || "Caso exige revisão avançada ou dados adicionais.");
  }
  if (candidateVote === "absent" || candidateVote === "abstain") {
    return neutralVoteDecision(normalized, "Ausência ou abstenção não altera score.");
  }
  if (normalized.publicInterestVote === "none" || normalized.publicInterestVote === "any") {
    if (normalized.classification === "neutral" || normalized.classification === "low_relevance") {
      return neutralVoteDecision(normalized, normalized.scoreSafetyReason || "Analisado, sem direção segura para pontuar um voto específico.");
    }
  }
  if (normalized.publicInterestVote !== "yes" && normalized.publicInterestVote !== "no") {
    return pendingVoteDecision(normalized, "pending_strong_review", "Não há voto de interesse público claro.");
  }

  const aligned = candidateVote === normalized.publicInterestVote;
  let delta = aligned ? basePointsFromSeverity(normalized.severity) : -basePointsFromSeverity(normalized.severity);
  if (
    normalized.classification === "negative_public_interest" ||
    normalized.classification === "harmful_or_self_serving"
  ) {
    delta = aligned ? Math.round(delta * 0.7) : delta;
  }
  if (normalized.classification === "low_relevance") delta = aligned ? -2 : 0;
  delta = applyScoreImpactLimit(delta, normalized.scoreImpactLimit ?? "low");
  delta = applyConfidenceLimit(delta, normalized.confidence);
  if (normalized.isProceduralVote && normalized.scoreImpactLimit === "low") {
    delta = Math.sign(delta) * Math.min(Math.abs(delta), MINI_SAFE_SCORE_CONFIG.maxMiniProceduralImpact);
  }
  delta = applyModelLimit(delta, normalized);
  if (delta === 0) {
    return neutralVoteDecision(normalized, normalized.scoreSafetyReason || "Pontuação final limitada a zero pelas regras de segurança.");
  }
  return {
    scoreDelta: delta,
    scorePoints: delta,
    affectsScore: true,
    analysisStatus: "validated" as AnalysisStatus,
    needsStrongReview: false,
    reviewReason: normalized.reviewReason || "Não precisa revisão avançada.",
    coverageCategory: "scored" as CoverageCategory,
    scoreSafetyReason: normalized.scoreSafetyReason || "Pontuação aplicada com segurança suficiente.",
  };
}

function shouldPendingVoteScore(analysis: PublicVoteAnalysis) {
  if (analysis.analysisStatus && analysis.analysisStatus !== "validated" && analysis.analysisStatus !== "neutral_validated") return true;
  if (analysis.needsStrongReview) return true;
  if (analysis.publicInterestVote === "indeterminate") return true;
  if (analysis.analyzedTextMatchesVoteObject === "false") return true;
  if (hasSpecificObjectScopeMismatch(analysis)) return true;
  if (analysis.riskFlags?.includes("scope_mismatch") === true) return true;
  if (analysis.riskFlags?.includes("vote_object_unclear") === true) return true;
  if (analysis.riskFlags?.includes("text_does_not_match_vote_object") === true) return true;
  if (analysis.riskFlags?.includes("insufficient_vote_object_text") === true && isMiniFirstSafetyAnalysis(analysis)) return true;
  if (analysis.criticalArticles?.some((article) => article.appearsInVoteObjectText === false) === true) return true;
  if (!isMiniFirstSafetyAnalysis(analysis)) return false;
  return (
    analysis.publicInterestVote === "none" ||
    analysis.publicInterestVote === "any" ||
    analysis.voteObjectType === "unclear" ||
    analysis.usedRelatedBillAsMainEvidence === true ||
    analysis.riskLevel === "high" ||
    analysis.riskLevel === "critical" ||
    analysis.netPublicEffect === "mixed" ||
    analysis.netPublicEffect === "unclear" ||
    analysis.netPublicEffect === "insufficient" ||
    analysis.confidence < MINI_SAFE_SCORE_CONFIG.minConfidenceToScoreWithMini
  );
}

function choosePendingStatus(analysis: PublicVoteAnalysis): AnalysisStatus {
  if (analysis.netPublicEffect === "mixed") return "mixed_requires_review";
  if (analysis.netPublicEffect === "insufficient" || analysis.netPublicEffect === "unclear") return "insufficient_data";
  if (isProceduralObject(analysis.voteObjectType) && analysis.confidence < MINI_SAFE_SCORE_CONFIG.minConfidenceToScoreWithMini) return "procedural_low_confidence";
  return "pending_strong_review";
}

function pendingVoteDecision(analysis: PublicVoteAnalysis, status: AnalysisStatus, reason: string) {
  return {
    scoreDelta: 0,
    scorePoints: null,
    affectsScore: false,
    analysisStatus: status,
    needsStrongReview: status !== "not_eligible",
    reviewReason: reason,
    coverageCategory: status === "insufficient_data" ? "insufficient" as CoverageCategory : "pending_review" as CoverageCategory,
    scoreSafetyReason: reason,
  };
}

function neutralVoteDecision(analysis: PublicVoteAnalysis, reason: string) {
  return {
    scoreDelta: 0,
    scorePoints: 0,
    affectsScore: false,
    analysisStatus: "neutral_validated" as AnalysisStatus,
    needsStrongReview: false,
    reviewReason: reason,
    coverageCategory: "neutral_analyzed" as CoverageCategory,
    scoreSafetyReason: reason || analysis.scoreSafetyReason || "Analisado, sem impacto no score.",
  };
}

function hasSpecificObjectScopeMismatch(analysis: PublicVoteAnalysis) {
  if (!isStrongN3Analysis(analysis) || !isSpecificVoteObject(analysis.voteObjectType)) return false;
  return (
    analysis.voteObjectTextFound !== true ||
    analysis.primaryTextUsed !== "vote_object" ||
    analysis.analyzedTextMatchesVoteObject !== "true"
  );
}

function isStrongN3Analysis(analysis: PublicVoteAnalysis) {
  return (
    analysis.analysisLevel === 3 ||
    analysis.analysisMethodVersion === LEGISLATIVE_IMPACT_V3_VERSION ||
    analysis.analysisMethodVersion === LEGISLATIVE_IMPACT_V4_VERSION
  );
}

function isMiniFirstSafetyAnalysis(analysis: PublicVoteAnalysis) {
  if (analysis.modelRole === "strong_review") return false;
  const model = normalizeProposalText(analysis.modelUsed || "");
  return (
    analysis.analysisMethodVersion === LEGISLATIVE_IMPACT_V4_VERSION ||
    analysis.methodologyVersion === LEGISLATIVE_IMPACT_V4_VERSION ||
    analysis.modelRole === "triage" ||
    model.includes("mini")
  );
}

function isSpecificVoteObject(type: VoteObjectType | undefined) {
  return (
    type === "amendment" ||
    type === "highlight" ||
    type === "substitute" ||
    type === "separate_vote"
  );
}

function isProceduralObject(type: VoteObjectType | undefined) {
  return (
    type === "urgency" ||
    type === "procedural_request" ||
    type === "postponement" ||
    type === "agenda_withdrawal" ||
    type === "appeal"
  );
}

function applyScoreImpactLimit(points: number, limit: ScoreImpactLimit) {
  const maxByLimit: Record<ScoreImpactLimit, number> = {
    none: 0,
    low: 3,
    medium: 8,
    high: 13,
    critical: 21,
  };
  return Math.sign(points) * Math.min(Math.abs(points), maxByLimit[limit]);
}

function applyConfidenceLimit(points: number, confidence: number) {
  if (confidence < 0.5) return 0;
  if (confidence < 0.65) return Math.sign(points) * Math.min(Math.abs(points), 3);
  if (confidence < 0.75) return Math.sign(points) * Math.min(Math.abs(points), 8);
  return points;
}

function applyModelLimit(points: number, analysis: PublicVoteAnalysis) {
  const model = normalizeProposalText(analysis.modelUsed || "");
  if (!model.includes("mini")) return points;
  if (isProceduralObject(analysis.voteObjectType)) {
    return Math.sign(points) * Math.min(Math.abs(points), MINI_SAFE_SCORE_CONFIG.maxMiniProceduralImpact);
  }
  if (isSpecificVoteObject(analysis.voteObjectType)) {
    return Math.sign(points) * Math.min(Math.abs(points), MINI_SAFE_SCORE_CONFIG.maxMiniSpecificObjectImpact);
  }
  return Math.sign(points) * Math.min(Math.abs(points), MINI_SAFE_SCORE_CONFIG.maxMiniScoreImpact);
}

function basePointsFromSeverity(severity: PublicVoteSeverity) {
  if (severity === "critical") return 21;
  if (severity === "high") return 13;
  if (severity === "medium") return 8;
  return 3;
}

function legacySeverityPoints(severity: PublicVoteSeverity) {
  if (severity === "critical") return 30;
  if (severity === "high") return 18;
  if (severity === "medium") return 10;
  return 4;
}

export function legacyPublicVoteScoreDelta(
  analysis: PublicVoteAnalysis,
  candidateVote: CandidateVote,
) {
  if (analysis.confidence < 0.6) return 0;
  if (candidateVote === "absent") {
    if (analysis.severity !== "high" && analysis.severity !== "critical") return 0;
    return analysis.severity === "critical" ? -8 : -4;
  }
  if (candidateVote === "abstain") return 0;
  if (analysis.publicInterestVote === "none") return 0;
  if (analysis.publicInterestVote === "any") return legacySeverityPoints(analysis.severity);

  const aligned = candidateVote === analysis.publicInterestVote;
  const points = legacySeverityPoints(analysis.severity);
  if (analysis.classification === "negative_public_interest") {
    return aligned ? Math.round(points * 0.6) : -points;
  }
  if (analysis.classification === "harmful_or_self_serving") {
    return aligned ? Math.round(points * 0.7) : -points;
  }
  if (analysis.classification === "low_relevance") {
    return aligned ? -2 : 0;
  }
  if (analysis.classification === "positive_public_interest") {
    return aligned ? points : -Math.round(points * 0.7);
  }
  return 0;
}

export function buildPublicVoteRecord(
  analysis: PublicVoteAnalysis,
  candidateId: number | string,
  candidateVote: CandidateVote,
): PublicVoteRecord {
  const decision = publicVoteScoreDecision(analysis, candidateVote);
  return {
    voteId: analysis.voteId,
    candidateId: String(candidateId),
    candidateVote,
    classification: analysis.classification,
    severity: analysis.severity,
    scoreDelta: decision.scoreDelta,
    scorePoints: decision.scorePoints,
    affectsScore: decision.affectsScore,
    analysisStatus: decision.analysisStatus,
    needsStrongReview: decision.needsStrongReview,
    reviewReason: decision.reviewReason,
    coverageCategory: decision.coverageCategory,
    scoreSafetyReason: decision.scoreSafetyReason,
    modelUsed: analysis.modelUsed,
    modelRole: analysis.modelRole,
    confidence: analysis.confidence,
    reason: analysis.reason,
    source: analysis.source,
    reviewedManually: analysis.reviewedManually,
  };
}

function publicVoteRule(
  voteId: string,
  analysis: Omit<
    PublicVoteAnalysis,
    "voteId" | "source" | "analysisLevel" | "reviewedManually" | "methodologyVersion"
  >,
): PublicVoteAnalysis {
  return {
    voteId,
    ...analysis,
    isProceduralVote: analysis.publicInterestVote === "none",
    legislativeType: "INCERTO",
    decisionNature: analysis.publicInterestVote === "none" ? "symbolic" : "substantive_policy",
    decisionScope: analysis.publicInterestVote === "none" ? "symbolic_only" : "national_policy",
    voteObjectType: "main_bill",
    analyzedTextMatchesVoteObject: "true",
    scoreImpactLimit: analysis.severity,
    netPublicEffect:
      analysis.classification === "positive_public_interest"
        ? "positive"
        : analysis.classification === "negative_public_interest" || analysis.classification === "harmful_or_self_serving"
          ? "negative"
          : "unclear",
    summaryMatchesText: "unclear",
    riskFlags: ["none"],
    criticalArticles: [],
    source: "rule",
    analysisLevel: 1,
    reviewedManually: false,
    methodologyVersion: METHODOLOGY_VERSION,
    analysisMethodVersion: METHODOLOGY_VERSION,
    modelRole: "rules_only",
    analysisStatus: analysis.publicInterestVote === "none" ? "neutral_validated" : "validated",
    affectsScore: analysis.publicInterestVote !== "none",
    needsStrongReview: false,
    coverageCategory: analysis.publicInterestVote === "none" ? "neutral_analyzed" : "scored",
  };
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}
