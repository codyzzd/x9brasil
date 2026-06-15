import classificationJson from "@/data/public-value-classifications.json";
import voteClassificationJson from "@/data/public-vote-classifications.json";

export const PUBLIC_VALUE_WEIGHTS = {
  contribution: 0.4,
  publicVotes: 0.2,
  efficiency: 0.2,
  participation: 0.1,
  transparency: 0.1,
} as const;

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
export type ProposalStage = "presented" | "advanced" | "converted";
export type PublicVoteClassification =
  | "positive_public_interest"
  | "neutral"
  | "low_relevance"
  | "negative_public_interest"
  | "harmful_or_self_serving";
export type PublicVoteSeverity = "low" | "medium" | "high" | "critical";
export type CandidateVote = "yes" | "no" | "abstain" | "absent";
export type PublicInterestVote = "yes" | "no" | "any" | "none";

export type ProposalClassification = {
  category: PublicValueCategory;
  confidence: ClassificationConfidence;
  justification: string;
  source: "reviewed" | "rule";
  methodologyVersion: string;
};

type ClassificationFile = {
  version: number;
  methodologyVersion: string;
  reviewedAt: string;
  classifications: Record<
    string,
    {
      category: PublicValueCategory;
      confidence: ClassificationConfidence;
      justification: string;
    }
  >;
};

const classificationFile = classificationJson as ClassificationFile;

type PublicVoteClassificationFile = {
  version: number;
  methodologyVersion: string;
  reviewedAt: string;
  classifications: Record<
    string,
    {
      classification: PublicVoteClassification;
      severity: PublicVoteSeverity;
      publicInterestVote: PublicInterestVote;
      confidence: number;
      reason: string;
    }
  >;
};

export type PublicVoteAnalysis = {
  voteId: string;
  classification: PublicVoteClassification;
  severity: PublicVoteSeverity;
  publicInterestVote: PublicInterestVote;
  confidence: number;
  reason: string;
  source: "reviewed" | "rule";
  reviewedManually: boolean;
  methodologyVersion: string;
};

export type PublicVoteRecord = {
  voteId: string;
  candidateId: string;
  candidateVote: CandidateVote;
  classification: PublicVoteClassification;
  severity: PublicVoteSeverity;
  scoreDelta: number;
  confidence: number;
  reason: string;
  source: string;
  reviewedManually: boolean;
};

const voteClassificationFile =
  voteClassificationJson as PublicVoteClassificationFile;

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

export function classifyProposal(
  proposalId: string,
  summary: string,
): ProposalClassification | null {
  const reviewed = classificationFile.classifications[proposalId];
  if (reviewed) {
    return {
      ...reviewed,
      source: "reviewed",
      methodologyVersion: classificationFile.methodologyVersion,
    };
  }

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
    methodologyVersion: classificationFile.methodologyVersion,
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

export function publicValueClassificationMetadata() {
  return {
    methodologyVersion: classificationFile.methodologyVersion,
    reviewedAt: classificationFile.reviewedAt,
  };
}

export function classifyPublicVote(
  voteId: string,
  description: string,
  summary: string,
): PublicVoteAnalysis | null {
  const reviewed = voteClassificationFile.classifications[voteId];
  if (reviewed) {
    return {
      voteId,
      ...reviewed,
      source: "reviewed",
      reviewedManually: true,
      methodologyVersion: voteClassificationFile.methodologyVersion,
    };
  }

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
  if (analysis.confidence < 0.6) return 0;
  if (candidateVote === "absent") {
    if (analysis.severity !== "high" && analysis.severity !== "critical") return 0;
    return analysis.severity === "critical" ? -8 : -4;
  }
  if (candidateVote === "abstain") return 0;
  if (analysis.publicInterestVote === "none") return 0;
  if (analysis.publicInterestVote === "any") return severityPoints(analysis.severity);

  const aligned = candidateVote === analysis.publicInterestVote;
  const points = severityPoints(analysis.severity);
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
  return {
    voteId: analysis.voteId,
    candidateId: String(candidateId),
    candidateVote,
    classification: analysis.classification,
    severity: analysis.severity,
    scoreDelta: publicVoteScoreDelta(analysis, candidateVote),
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
    "voteId" | "source" | "reviewedManually" | "methodologyVersion"
  >,
): PublicVoteAnalysis {
  return {
    voteId,
    ...analysis,
    source: "rule",
    reviewedManually: false,
    methodologyVersion: voteClassificationFile.methodologyVersion,
  };
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function severityPoints(severity: PublicVoteSeverity) {
  if (severity === "critical") return 30;
  if (severity === "high") return 18;
  if (severity === "medium") return 10;
  return 4;
}
