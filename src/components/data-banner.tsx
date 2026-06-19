import { getDataBannerStats } from "@/lib/db";

export async function DataBanner() {
  const stats = await getBannerStats();
  if (!stats) return null;

  return (
    <div className="w-full border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex min-h-9 items-center gap-2 overflow-x-auto px-3 py-1.5 text-xs whitespace-nowrap sm:justify-center sm:text-sm">
        <MetricPill
          label="Dados públicos analisados"
          value={formatPercent(stats.coveragePercent)}
          title={`${formatInteger(stats.classifiedItems)} de ${formatInteger(stats.totalItems)} proposições e votações já analisadas`}
        />
      </div>
    </div>
  );
}

async function getBannerStats() {
  try {
    return await getDataBannerStats();
  } catch (error) {
    console.error("Failed to render data banner", error);
    return null;
  }
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
