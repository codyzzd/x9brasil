import type {
  PublicValueRankedDeputy,
  RankedDeputy,
  RankingIndex,
  RawMetrics,
} from "@/lib/ranking";

export type DimensionExplanation = {
  title: string;
  description: string;
  details: string[];
};

export type DimensionKey =
  | "participation"
  | "production"
  | "resources"
  | "contribution"
  | "publicVotes"
  | "efficiency"
  | "transparency";

type AnyRankedDeputy = RankedDeputy | PublicValueRankedDeputy;

export function dimensionExplanation(
  deputy: AnyRankedDeputy,
  index: RankingIndex,
  dimension: DimensionKey,
): DimensionExplanation {
  if (dimension === "transparency") {
    return transparencyExplanation(deputy.metrics);
  }
  if (dimension === "participation") {
    return participationExplanation(deputy.metrics, index);
  }
  if (dimension === "contribution") {
    return contributionExplanation(deputy.metrics);
  }
  if (dimension === "publicVotes") {
    return publicVotesExplanation(deputy.metrics);
  }
  if (dimension === "efficiency") {
    return efficiencyExplanation(deputy.metrics);
  }
  if (dimension === "production") {
    return productionExplanation(deputy.metrics);
  }
  return resourcesExplanation(deputy.metrics);
}

function publicVotesExplanation(metrics: RawMetrics): DimensionExplanation {
  return {
    title: "Votos públicos",
    description:
      "Percentil nacional do saldo auditável de votos nominais classificados por impacto público, ajustado pelos meses de mandato.",
    details: [
      `${formatDecimal(metrics.publicVoteScore)} pontos líquidos em ${formatInteger(
        metrics.publicVotesAnalyzed,
      )} votos analisados.`,
      `${formatDecimal(metrics.publicVotePositivePoints)} pontos positivos; ${formatDecimal(
        metrics.publicVoteNegativePenalties,
      )} em penalidades por voto e ${formatDecimal(
        metrics.publicVoteAbsencePenalties,
      )} por ausência.`,
      `Confiança média: ${formatPercent(
        metrics.publicVoteAverageConfidence === null ||
          metrics.publicVoteAverageConfidence === undefined
          ? null
          : metrics.publicVoteAverageConfidence * 100,
      )}.`,
    ],
  };
}

export function publicValueEfficiencyPerHundredThousand(metrics: RawMetrics) {
  const points = metrics.publicContributionPoints;
  const expenses = metrics.expensesTotal;
  if (
    points === null ||
    points === undefined ||
    expenses === null ||
    expenses <= 0
  ) {
    return null;
  }
  return (points / expenses) * 100_000;
}

function participationExplanation(
  metrics: RawMetrics,
  index: RankingIndex,
): DimensionExplanation {
  return {
    title: "Participação",
    description:
      index === "public-value"
        ? "Média dos percentis nacionais de sessões e votos nominais por mês de mandato."
        : "Média dos percentis de sessões e votos nominais por mês dentro do grupo comparado.",
    details: [
      `${formatInteger(metrics.plenaryAttendances)} sessões e ${formatInteger(
        metrics.nominalVotes,
      )} votos nominais.`,
      `Período equivalente a ${formatDecimal(metrics.monthsInOffice)} meses em exercício.`,
    ],
  };
}

function contributionExplanation(metrics: RawMetrics): DimensionExplanation {
  const pointsPerMonth =
    metrics.publicContributionPoints === null ||
    metrics.publicContributionPoints === undefined ||
    metrics.monthsInOffice <= 0
      ? null
      : metrics.publicContributionPoints / metrics.monthsInOffice;
  return {
    title: "Contribuição pública",
    description:
      "Percentil nacional dos pontos por tema, autoria e estágio, ajustados pelos meses de mandato.",
    details: [
      `${formatDecimal(metrics.publicContributionPoints)} pontos no período; ${formatDecimal(
        pointsPerMonth,
      )} por mês.`,
      `${formatInteger(metrics.publicClassifiedProposals)} de ${formatInteger(
        metrics.publicTotalProposals,
      )} proposições classificadas.`,
    ],
  };
}

function efficiencyExplanation(metrics: RawMetrics): DimensionExplanation {
  const ratio = publicValueEfficiencyPerHundredThousand(metrics);
  return {
    title: "Eficiência financeira",
    description:
      "Percentil nacional da relação entre pontos de contribuição e gastos da CEAP no mesmo período.",
    details: [
      `${formatDecimal(ratio)} pontos de contribuição por R$ 100 mil gastos.`,
      "Não usa presença ou votos e não é uma média mensal.",
    ],
  };
}

function productionExplanation(metrics: RawMetrics): DimensionExplanation {
  const weighted =
    metrics.substantiveProposals === null ||
    metrics.oversightProposals === null ||
    metrics.advancedProposals === null ||
    metrics.convertedProposals === null
      ? null
      : metrics.substantiveProposals +
        metrics.oversightProposals * 0.5 +
        metrics.advancedProposals * 0.75 +
        metrics.convertedProposals * 2;
  const monthly =
    weighted === null || metrics.monthsInOffice <= 0
      ? null
      : weighted / metrics.monthsInOffice;
  return {
    title: "Produção",
    description:
      "Percentil da produção legislativa ponderada por tipo e avanço, dividido pelos meses de mandato.",
    details: [
      `${formatInteger(metrics.substantiveProposals)} substantivas, ${formatInteger(
        metrics.oversightProposals,
      )} de fiscalização e ${formatInteger(metrics.convertedProposals)} normas.`,
      `${formatDecimal(weighted)} pontos ponderados; ${formatDecimal(monthly)} por mês.`,
    ],
  };
}

function resourcesExplanation(metrics: RawMetrics): DimensionExplanation {
  const concentration =
    metrics.supplierConcentration === null
      ? null
      : metrics.supplierConcentration * 100;
  return {
    title: "Uso de recursos",
    description:
      "Combina a compatibilidade entre despesa e atividade com a distribuição dos gastos entre fornecedores.",
    details: [
      `${formatCurrency(metrics.expensesTotal)} gastos no período.`,
      `Concentração por fornecedor: ${formatPercent(concentration)}.`,
    ],
  };
}

function transparencyExplanation(metrics: RawMetrics): DimensionExplanation {
  const blocks = [
    ["Candidatura", metrics.campaignCandidacyAvailable],
    ["Bens", metrics.assetsAvailable],
    ["Receitas eleitorais", metrics.campaignReceiptsAvailable],
    ["Despesas eleitorais", metrics.campaignExpensesAvailable],
    ["Situação das contas", metrics.accountsStatusAvailable],
  ] as const;
  const available = blocks.filter(([, value]) => value).map(([label]) => label);
  const missing = blocks.filter(([, value]) => !value).map(([label]) => label);
  return {
    title: "Transparência",
    description:
      "Disponibilidade de cinco blocos oficiais. Cada bloco disponível vale 20 pontos.",
    details: [
      `${available.length}/5 disponíveis: ${available.join(", ") || "nenhum"}.`,
      `Ausentes: ${missing.join(", ") || "nenhum"}.`,
    ],
  };
}

function formatInteger(value: number | null | undefined) {
  return value === null || value === undefined
    ? "N/D"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number | null | undefined) {
  return value === null || value === undefined
    ? "N/D"
    : new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
}

function formatCurrency(value: number | null) {
  return value === null
    ? "Valor indisponível"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "N/D" : `${formatDecimal(value)}%`;
}
