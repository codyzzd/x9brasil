import type {
  PublicValueRankedDeputy,
  RankedDeputy,
  RankingIndex,
  RawMetrics,
} from "@/lib/ranking";
import { top3Share } from "@/lib/ranking";
import { PUBLIC_VALUE_DIMENSION_LABELS } from "@/lib/public-value";

export type DimensionExplanation = {
  title: string;
  description: string;
  details: string[];
};

export type CalculationBreakdown = {
  lines: string[];
};

export type DimensionCardStep = {
  title: string;
  result: string;
};

export type DimensionCardInfo = {
  subtitle: string;
  formulaLine: string;
  rateLabel: string;
  chips: { label: string; value: string }[];
  steps: DimensionCardStep[];
};

export type DimensionKey =
  | "participation"
  | "production"
  | "resources"
  | "contribution"
  | "publicVotes"
  | "efficiency"
  | "campaignFinance";

type AnyRankedDeputy = RankedDeputy | PublicValueRankedDeputy;

export function dimensionExplanation(
  deputy: AnyRankedDeputy,
  index: RankingIndex,
  dimension: DimensionKey,
): DimensionExplanation {
  if (dimension === "campaignFinance") {
    return campaignFinanceExplanation(deputy.metrics);
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

export function dimensionCalculationBreakdown(
  metrics: RawMetrics,
  dimensionValue: number | null,
  dimension: DimensionKey,
): CalculationBreakdown {
  switch (dimension) {
    case "contribution":
      return contributionSteps(metrics, dimensionValue);
    case "publicVotes":
      return publicVotesSteps(metrics, dimensionValue);
    case "efficiency":
      return efficiencySteps(metrics, dimensionValue);
    case "participation":
      return participationSteps(metrics, dimensionValue);
    case "campaignFinance":
      return campaignFinanceSteps(metrics, dimensionValue);
    case "production":
      return productionSteps(metrics, dimensionValue);
    case "resources":
      return resourcesSteps(metrics, dimensionValue);
  }
}

export function getDimensionCardInfo(
  metrics: RawMetrics,
  dimensionValue: number | null,
  dimension: DimensionKey,
): DimensionCardInfo {
  const score = dimensionValue;
  switch (dimension) {
    case "contribution":
      return contributionCardInfo(metrics, score);
    case "publicVotes":
      return publicVotesCardInfo(metrics, score);
    case "efficiency":
      return efficiencyCardInfo(metrics, score);
    case "participation":
      return participationCardInfo(metrics, score);
    case "campaignFinance":
      return campaignFinanceCardInfo(metrics, score);
    default:
      return {
        subtitle: "",
        formulaLine: "",
        rateLabel: "",
        chips: [],
        steps: [],
      };
  }
}

function contributionCardInfo(
  metrics: RawMetrics,
  score: number | null,
): DimensionCardInfo {
  const points = metrics.publicContributionPoints;
  const months = metrics.monthsInOffice;
  const hasData = points !== null && points !== undefined && months > 0;
  const perMonth = hasData ? points / months : null;

  const formattedPoints = formatDecimal(points);
  const formattedMonths = formatInteger(months);
  const formattedPerMonth = hasData ? formatDecimal(perMonth!) : "—";
  const pct = score !== null ? formatInteger(score) : null;

  return {
    subtitle: "Produção útil ajustada pelo tempo de mandato",
    formulaLine: hasData
      ? `${formattedPoints} pts acumulados ÷ ${formattedMonths} meses = ${formattedPerMonth} pts/mês`
      : "Dados insuficientes",
    rateLabel: hasData ? `${formattedPerMonth} pts/mês` : "—",
    chips: [
      { label: "pts/mês", value: formattedPerMonth },
      { label: "pts acumulados", value: formattedPoints },
      { label: "meses de mandato", value: formattedMonths },
    ],
    steps: [
      {
        title: "Pontuação acumulada do deputado",
        result: `${formattedPoints} pontos`,
      },
      {
        title: "Divisão pelo tempo de mandato",
        result: hasData
          ? `${formattedPoints} ÷ ${formattedMonths} meses = ${formattedPerMonth} pts/mês`
          : "Dados insuficientes",
      },
      {
        title: "Comparação com os demais deputados",
        result:
          pct && hasData
            ? `${formattedPerMonth} pts/mês supera ${pct}% dos deputados`
            : "Dados insuficientes",
      },
      {
        title: "Transformação em nota",
        result: pct ? `${pct}% = nota ${pct}/100` : "Sem nota",
      },
    ],
  };
}

function publicVotesCardInfo(
  metrics: RawMetrics,
  score: number | null,
): DimensionCardInfo {
  const netScore = metrics.publicVoteScore;
  const months = metrics.monthsInOffice;
  const analyzed = metrics.publicVotesAnalyzed || 0;
  const hasData = netScore !== null && netScore !== undefined && months > 0;
  const perMonth = hasData ? netScore / months : null;

  const formattedNet = formatDecimal(netScore);
  const formattedMonths = formatInteger(months);
  const formattedPerMonth = hasData ? formatDecimal(perMonth!) : "—";
  const pct = score !== null ? formatInteger(score) : null;

  return {
    subtitle: "Posicionamento em votações de interesse público",
    formulaLine: hasData
      ? `${formattedNet} pts líquidos ÷ ${formattedMonths} meses = ${formattedPerMonth} pts/mês`
      : "Dados insuficientes",
    rateLabel: hasData ? `${formattedPerMonth} pts/mês` : "—",
    chips: [
      { label: "pts/mês", value: formattedPerMonth },
      { label: "pts líquidos", value: formattedNet },
      { label: "votos analisados", value: formatInteger(analyzed) },
    ],
    steps: [
      {
        title: "Pontuação líquida de votos",
        result: `${formattedNet} pontos em ${formatInteger(analyzed)} votos analisados`,
      },
      {
        title: "Divisão pelo tempo de mandato",
        result: hasData
          ? `${formattedNet} ÷ ${formattedMonths} meses = ${formattedPerMonth} pts/mês`
          : "Dados insuficientes",
      },
      {
        title: "Comparação com os demais deputados",
        result:
          pct && hasData
            ? `${formattedPerMonth} pts/mês supera ${pct}% dos deputados`
            : "Dados insuficientes",
      },
      {
        title: "Transformação em nota",
        result: pct ? `${pct}% = nota ${pct}/100` : "Sem nota",
      },
    ],
  };
}

function efficiencyCardInfo(
  metrics: RawMetrics,
  score: number | null,
): DimensionCardInfo {
  const points = metrics.publicContributionPoints;
  const expenses = metrics.expensesTotal;
  const hasData =
    points !== null &&
    points !== undefined &&
    expenses !== null &&
    expenses > 0;
  const ratio = hasData ? (points / expenses) * 100_000 : null;

  const formattedPoints = formatDecimal(points);
  const formattedExpenses = formatCurrency(expenses);
  const formattedRatio = hasData ? formatDecimal(ratio!) : "—";
  const pct = score !== null ? formatInteger(score) : null;

  return {
    subtitle: "Contribuição por real gasto da cota parlamentar",
    formulaLine: hasData
      ? `${formattedPoints} pts ÷ ${formattedExpenses} × 100.000 = ${formattedRatio} pts/R$ 100 mil`
      : "Dados insuficientes",
    rateLabel: hasData ? `${formattedRatio} pts/R$ 100 mil` : "—",
    chips: [
      { label: "pts/R$ 100 mil", value: formattedRatio },
      { label: "pts de contribuição", value: formattedPoints },
      { label: "gastos CEAP", value: formattedExpenses },
    ],
    steps: [
      {
        title: "Pontos de contribuição no período",
        result: `${formattedPoints} pontos`,
      },
      {
        title: "Relação com gastos da cota parlamentar",
        result: hasData
          ? `${formattedPoints} pts ÷ ${formattedExpenses} × 100.000 = ${formattedRatio} pts/R$ 100 mil`
          : "Dados insuficientes",
      },
      {
        title: "Comparação com os demais deputados",
        result:
          pct && hasData
            ? `${formattedRatio} pts/R$ 100 mil supera ${pct}% dos deputados`
            : "Dados insuficientes",
      },
      {
        title: "Transformação em nota",
        result: pct ? `${pct}% = nota ${pct}/100` : "Sem nota",
      },
    ],
  };
}

function participationCardInfo(
  metrics: RawMetrics,
  score: number | null,
): DimensionCardInfo {
  const months = metrics.monthsInOffice;
  const attendances = metrics.plenaryAttendances;
  const votes = metrics.nominalVotes;

  const formattedMonths = formatInteger(months);
  const formattedAtt = formatInteger(attendances);
  const formattedVotes = formatInteger(votes);
  const attPerMonth =
    months > 0 && attendances !== null
      ? formatDecimal(attendances / months)
      : "—";
  const votesPerMonth =
    months > 0 && votes !== null ? formatDecimal(votes / months) : "—";
  const pct = score !== null ? formatInteger(score) : null;

  return {
    subtitle: "Presença e engajamento em plenário",
    formulaLine:
      months > 0
        ? `Sessões: ${formattedAtt} ÷ ${formattedMonths} = ${attPerMonth}/mês · Votos: ${formattedVotes} ÷ ${formattedMonths} = ${votesPerMonth}/mês`
        : "Dados insuficientes",
    rateLabel: pct ? `Supera ${pct}% dos deputados` : "—",
    chips: [
      { label: "sessões", value: formattedAtt },
      { label: "votos nominais", value: formattedVotes },
      { label: "meses de mandato", value: formattedMonths },
    ],
    steps: [
      {
        title: "Presença em plenário",
        result: `${formattedAtt} sessões deliberativas`,
      },
      {
        title: "Engajamento em votações",
        result: `${formattedVotes} votos nominais`,
      },
      {
        title: "Cálculo das taxas mensais",
        result:
          months > 0
            ? `Sessões: ${formattedAtt} ÷ ${formattedMonths} = ${attPerMonth}/mês · Votos: ${formattedVotes} ÷ ${formattedMonths} = ${votesPerMonth}/mês`
            : "Período sem meses em exercício",
      },
      {
        title: "Comparação com os demais deputados",
        result:
          pct && months > 0
            ? `Média dos percentis de sessões e votos supera ${pct}% dos deputados`
            : "Dados insuficientes",
      },
      {
        title: "Transformação em nota",
        result: pct ? `${pct}% = nota ${pct}/100` : "Sem nota",
      },
    ],
  };
}

function contributionSteps(
  metrics: RawMetrics,
  score: number | null,
): CalculationBreakdown {
  const points = metrics.publicContributionPoints;
  const months = metrics.monthsInOffice;
  if (
    points === null ||
    points === undefined ||
    months <= 0
  ) {
    return {
      lines: score === null ? ["Dados insuficientes"] : [`→ Nota: ${score}/100`],
    };
  }
  const perMonth = points / months;
  return {
    lines: [
      `${formatDecimal(points)} pts ÷ ${formatInteger(months)} meses = ${formatDecimal(perMonth)}/mês`,
      score !== null
        ? `${formatDecimal(perMonth)}/mês supera ${formatInteger(score)}% dos deputados → Nota: ${formatInteger(score)}/100`
        : "→ Dados insuficientes para percentil",
    ],
  };
}

function publicVotesSteps(
  metrics: RawMetrics,
  score: number | null,
): CalculationBreakdown {
  const netScore = metrics.publicVoteScore;
  const months = metrics.monthsInOffice;
  if (
    netScore === null ||
    netScore === undefined ||
    months <= 0
  ) {
    return {
      lines: score === null ? ["Dados insuficientes"] : [`→ Nota: ${score}/100`],
    };
  }
  const perMonth = netScore / months;
  return {
    lines: [
      `${formatDecimal(netScore)} pts ÷ ${formatInteger(months)} meses = ${formatDecimal(perMonth)}/mês`,
      score !== null
        ? `${formatDecimal(perMonth)}/mês supera ${formatInteger(score)}% dos deputados → Nota: ${formatInteger(score)}/100`
        : "→ Dados insuficientes para percentil",
    ],
  };
}

function efficiencySteps(
  metrics: RawMetrics,
  score: number | null,
): CalculationBreakdown {
  const points = metrics.publicContributionPoints;
  const expenses = metrics.expensesTotal;
  if (
    points === null ||
    points === undefined ||
    expenses === null ||
    expenses <= 0
  ) {
    return {
      lines: score === null ? ["Dados insuficientes"] : [`→ Nota: ${score}/100`],
    };
  }
  const ratio = (points / expenses) * 100_000;
  return {
    lines: [
      `${formatDecimal(points)} pts ÷ ${formatCurrency(expenses)} × 100.000 = ${formatDecimal(ratio)} pts/R$ 100 mil`,
      score !== null
        ? `${formatDecimal(ratio)} pts/R$ 100 mil supera ${formatInteger(score)}% dos deputados → Nota: ${formatInteger(score)}/100`
        : "→ Dados insuficientes para percentil",
    ],
  };
}

function participationSteps(
  metrics: RawMetrics,
  score: number | null,
): CalculationBreakdown {
  const months = metrics.monthsInOffice;
  const lines: string[] = [];
  if (months > 0) {
    const attendances = metrics.plenaryAttendances;
    const votes = metrics.nominalVotes;
    if (attendances !== null) {
      lines.push(
        `Sessões: ${formatInteger(attendances)} ÷ ${formatInteger(months)} = ${formatDecimal(attendances / months)}/mês`,
      );
    }
    if (votes !== null) {
      lines.push(
        `Votos: ${formatInteger(votes)} ÷ ${formatInteger(months)} = ${formatDecimal(votes / months)}/mês`,
      );
    }
  } else {
    lines.push("Período sem meses em exercício");
  }
  if (score !== null) {
    lines.push(`Média supera ${formatInteger(score)}% dos deputados → Nota: ${formatInteger(score)}/100`);
  } else {
    lines.push("→ Dados insuficientes para percentil");
  }
  return { lines };
}

function productionSteps(
  metrics: RawMetrics,
  score: number | null,
): CalculationBreakdown {
  const lines: string[] = [];
  const weighted =
    metrics.substantiveProposals !== null &&
    metrics.oversightProposals !== null &&
    metrics.advancedProposals !== null &&
    metrics.convertedProposals !== null
      ? metrics.substantiveProposals +
        metrics.oversightProposals * 0.5 +
        metrics.advancedProposals * 0.75 +
        metrics.convertedProposals * 2
      : null;
  if (weighted !== null && metrics.monthsInOffice > 0) {
    const monthly = weighted / metrics.monthsInOffice;
    lines.push(
      `Ponderado: ${formatDecimal(weighted)} pts ÷ ${formatInteger(metrics.monthsInOffice)} meses = ${formatDecimal(monthly)}/mês`,
    );
  } else if (weighted !== null) {
    lines.push(`Ponderado: ${formatDecimal(weighted)} pts`);
  }
  if (score !== null) {
    lines.push(`→ Nota: ${formatInteger(score)}/100 (percentil nacional)`);
  } else {
    lines.push("→ Dados insuficientes para percentil");
  }
  return { lines };
}

function resourcesSteps(
  metrics: RawMetrics,
  score: number | null,
): CalculationBreakdown {
  const lines: string[] = [];
  const concentration =
    metrics.supplierConcentration !== null
      ? metrics.supplierConcentration * 100
      : null;
  if (metrics.expensesTotal !== null) {
    lines.push(`Gastos: ${formatCurrency(metrics.expensesTotal)}`);
  }
  if (concentration !== null) {
    lines.push(`Concentração HHI: ${formatPercent(concentration)}`);
  }
  if (score !== null) {
    lines.push(`→ Nota: ${formatInteger(score)}/100`);
  } else {
    lines.push("→ Dados insuficientes");
  }
  return { lines };
}

function publicVotesExplanation(metrics: RawMetrics): DimensionExplanation {
  return {
    title: PUBLIC_VALUE_DIMENSION_LABELS.publicVotes,
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
    title: PUBLIC_VALUE_DIMENSION_LABELS.contribution,
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
    title: PUBLIC_VALUE_DIMENSION_LABELS.efficiency,
    description:
      "Percentil nacional da relação entre pontos de produção e gastos da CEAP no mesmo período.",
    details: [
      `${formatDecimal(ratio)} pontos de produção por R$ 100 mil gastos.`,
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

function campaignFinanceExplanation(metrics: RawMetrics): DimensionExplanation {
  const costPerVote =
    metrics.totalCampaignExpenses !== null && metrics.totalVotes !== null && metrics.totalVotes > 0
      ? formatCurrency(metrics.totalCampaignExpenses / metrics.totalVotes)
      : "indisponível";
  const publicDep =
    metrics.totalPublicReceipts !== null && metrics.totalCampaignReceipts !== null && metrics.totalCampaignReceipts > 0
      ? formatPercent(metrics.totalPublicReceipts / metrics.totalCampaignReceipts * 100)
      : "indisponível";
  const hasFinance = metrics.totalCampaignReceipts !== null || metrics.totalCampaignExpenses !== null;
  return {
    title: PUBLIC_VALUE_DIMENSION_LABELS.campaignFinance,
    description: hasFinance
      ? "Indicadores de custo por voto, dependência de dinheiro público, concentração de receitas e despesas, e consistência patrimonial."
      : "Dados de prestação de contas eleitorais não disponíveis para este candidato.",
    details: [
      `Custo por voto: ${costPerVote}`,
      `Dependência de dinheiro público: ${publicDep}`,
      `Doadores declarados: ${formatInteger(metrics.campaignDonorsCount ?? metrics.topDonors?.length ?? 0)}`,
      `Fornecedores declarados: ${formatInteger(metrics.campaignSuppliersCount ?? metrics.topSuppliers?.length ?? 0)}`,
    ],
  };
}

function campaignFinanceCardInfo(
  metrics: RawMetrics,
  score: number | null,
): DimensionCardInfo {
  const costPerVote =
    metrics.totalCampaignExpenses !== null && metrics.totalVotes !== null && metrics.totalVotes > 0
      ? formatCurrency(metrics.totalCampaignExpenses / metrics.totalVotes)
      : "—";
  const publicDep =
    metrics.totalPublicReceipts !== null && metrics.totalCampaignReceipts !== null && metrics.totalCampaignReceipts > 0
      ? formatPercent(metrics.totalPublicReceipts / metrics.totalCampaignReceipts * 100)
      : "—";
  const donorShare = top3Share(metrics.campaignDonorTop3Share, metrics.topDonors);
  const supplierShare = top3Share(metrics.campaignSupplierTop3Share, metrics.topSuppliers);
  const donorConc = donorShare !== null
    ? formatPercent(donorShare * 100)
    : "—";
  const supplierConc = supplierShare !== null
    ? formatPercent(supplierShare * 100)
    : "—";
  const patrimonyLabel = !metrics.assetsAvailable
    ? "—"
    : "Disponível";

  return {
    subtitle: "Origem dos recursos, gastos e eficiência eleitoral",
    formulaLine: score !== null
      ? `Média ponderada dos indicadores disponíveis = ${formatInteger(score)}/100`
      : "Dados insuficientes",
    rateLabel: score !== null ? `${formatInteger(score)}/100` : "—",
    chips: [
      { label: "Custo por voto", value: costPerVote },
      { label: "Dependência de dinheiro público", value: publicDep },
      { label: "Concentração de receitas", value: donorConc },
      { label: "Concentração de despesas", value: supplierConc },
    ],
    steps: [
      {
        title: "Custo por voto (35% — menor é melhor)",
        result: costPerVote,
      },
      {
        title: "Dependência de dinheiro público (25% — menor é melhor)",
        result: publicDep,
      },
      {
        title: "Concentração de receitas (15% — menor é melhor)",
        result: donorConc,
      },
      {
        title: "Concentração de despesas (15% — menor é melhor)",
        result: supplierConc,
      },
      {
        title: "Consistência patrimonial (10%)",
        result: patrimonyLabel,
      },
      {
        title: "Cálculo da nota",
        result: score !== null
          ? `Média ponderada dos percentis = ${formatInteger(score)}/100`
          : "Dados insuficientes",
      },
    ],
  };
}

function campaignFinanceSteps(
  metrics: RawMetrics,
  score: number | null,
): CalculationBreakdown {
  const lines: string[] = [];
  const indicators: string[] = [];
  const weights: string[] = [];

  if (metrics.totalCampaignExpenses !== null && metrics.totalVotes !== null && metrics.totalVotes > 0) {
    const costPerVote = metrics.totalCampaignExpenses / metrics.totalVotes;
    indicators.push(`Custo/voto: ${formatCurrency(costPerVote)}`);
    weights.push("35%");
  }
  if (metrics.totalPublicReceipts !== null && metrics.totalCampaignReceipts !== null && metrics.totalCampaignReceipts > 0) {
    const pct = metrics.totalPublicReceipts / metrics.totalCampaignReceipts * 100;
    indicators.push(`Dep. dinheiro público: ${formatPercent(pct)}`);
    weights.push("25%");
  }
  const donorShare = top3Share(metrics.campaignDonorTop3Share, metrics.topDonors);
  const supplierShare = top3Share(metrics.campaignSupplierTop3Share, metrics.topSuppliers);
  if (donorShare !== null) {
    const conc = donorShare * 100;
    indicators.push(`Conc. receitas: ${formatPercent(conc)}`);
    weights.push("15%");
  }
  if (supplierShare !== null) {
    const conc = supplierShare * 100;
    indicators.push(`Conc. despesas: ${formatPercent(conc)}`);
    weights.push("15%");
  }
  if (metrics.assetsAvailable) {
    indicators.push("Consistência patrimonial: disponível");
    weights.push("10%");
  }

  if (indicators.length > 0) {
    lines.push(`Indicadores: ${indicators.join("; ")}.`);
    lines.push(`Pesos: ${weights.join(", ")}.`);
    lines.push(
      score !== null
        ? `Média ponderada dos percentis = ${formatInteger(score)}/100`
        : "→ Dados insuficientes para percentil",
    );
  } else {
    lines.push(score !== null ? `→ Nota: ${formatInteger(score)}/100` : "Dados indisponíveis");
  }
  return { lines };
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
