import classificationJson from "@/data/public-value-classifications.json";

export const PUBLIC_VALUE_WEIGHTS = {
  contribution: 0.5,
  efficiency: 0.25,
  participation: 0.15,
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
