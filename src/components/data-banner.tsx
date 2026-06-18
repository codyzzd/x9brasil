import { getDataBannerStats } from "@/lib/db";

export async function DataBanner() {
  const stats = await getDataBannerStats();

  return (
    <div className="w-full border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex min-h-9 items-center gap-2 overflow-x-auto px-3 py-1.5 text-xs whitespace-nowrap sm:justify-center sm:text-sm">
        <MetricPill
          label="Cobertura"
          value={formatPercent(stats.coveragePercent)}
          title={`${formatInteger(stats.classifiedItems)} de ${formatInteger(stats.totalItems)} itens analisáveis classificados`}
        />
        <MetricPill
          label="N1"
          value={formatPercent(stats.levels.level1.percent)}
          title={`${formatInteger(stats.levels.level1.count)} itens com análise nível 1`}
        />
        <MetricPill
          label="N2"
          value={formatPercent(stats.levels.level2.percent)}
          title={`${formatInteger(stats.levels.level2.count)} itens com análise nível 2`}
        />
        <MetricPill
          label="N3"
          value={formatPercent(stats.levels.level3.percent)}
          title={`${formatInteger(stats.levels.level3.count)} itens com análise nível 3`}
        />
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-white/65 px-2 py-0.5 text-amber-950 shadow-xs dark:border-amber-700 dark:bg-amber-900/55 dark:text-amber-50"
    >
      <span className="text-amber-700 dark:text-amber-200">{label}</span>
      <strong className="font-semibold tabular-nums">{value}</strong>
    </span>
  );
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatInteger(value: number) {
  return value.toLocaleString("pt-BR");
}
