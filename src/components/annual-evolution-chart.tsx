"use client";

import { useState } from "react";
import { PUBLIC_VALUE_DIMENSION_LABELS } from "@/lib/public-value";
import { cn } from "@/lib/utils";

export type AnnualEvolutionPoint = {
  year: string;
  partial: boolean;
  rank: number | null;
  score: number | null;
  participation: number | null;
  production: number | null;
  resources: number | null;
  campaignFinance: number | null;
};

type ScoreKey =
  | "score"
  | "participation"
  | "production"
  | "resources"
  | "campaignFinance";

type Series = {
  key: ScoreKey;
  label: string;
  color: string;
};

const WIDTH = 900;
const HEIGHT = 360;
const MARGIN = { top: 20, right: 58, bottom: 44, left: 52 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const SCORE_TICKS = [0, 25, 50, 75, 100];

export function AnnualEvolutionChart({
  data,
  productionLabel,
  resourcesLabel,
}: {
  data: AnnualEvolutionPoint[];
  productionLabel: string;
  resourcesLabel: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const series: Series[] = [
    { key: "score", label: "Score", color: "#171717" },
    { key: "participation", label: "Participação", color: "#2563eb" },
    { key: "production", label: productionLabel, color: "#059669" },
    { key: "resources", label: resourcesLabel, color: "#d97706" },
    { key: "campaignFinance", label: "Campanha", color: "#db2777" },
  ];
  const ranks = data.flatMap((point) =>
    point.rank === null ? [] : [point.rank],
  );
  const rankMax = Math.max(10, ...ranks);
  const activeX =
    activeIndex === null ? 0 : xPosition(activeIndex, data.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {series.map((item) => (
          <LegendItem key={item.key} color={item.color} label={item.label} />
        ))}
        <LegendItem color="#7c3aed" label="Posição" dashed />
      </div>

      <div className="w-full overflow-x-auto pb-1">
        <div
          className="relative min-w-[720px]"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="block h-auto w-full"
            role="img"
            aria-labelledby="annual-chart-title annual-chart-description"
          >
            <title id="annual-chart-title">Evolução anual do candidato</title>
            <desc id="annual-chart-description">
              Gráfico de linhas com score, dimensões e posição no ranking por
              ano. A escala de notas fica à esquerda e a de posição, invertida,
              à direita.
            </desc>

            {SCORE_TICKS.map((tick) => {
              const y = scoreY(tick);
              return (
                <g key={tick}>
                  <line
                    x1={MARGIN.left}
                    x2={WIDTH - MARGIN.right}
                    y1={y}
                    y2={y}
                    className="stroke-border"
                    strokeWidth="1"
                  />
                  <text
                    x={MARGIN.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[11px] tabular-nums"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            <text
              x={MARGIN.left}
              y={12}
              className="fill-muted-foreground text-[11px] font-medium"
            >
              Nota
            </text>
            <text
              x={WIDTH - MARGIN.right}
              y={12}
              textAnchor="end"
              className="fill-muted-foreground text-[11px] font-medium"
            >
              Posição
            </text>

            {[1, Math.ceil(rankMax / 2), rankMax].map((tick) => {
              const y = rankY(tick, rankMax);
              return (
                <text
                  key={tick}
                  x={WIDTH - MARGIN.right + 12}
                  y={y + 4}
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {tick}º
                </text>
              );
            })}

            {series.map((item) => (
              <path
                key={item.key}
                d={linePath(data, (point) => point[item.key], scoreY)}
                fill="none"
                stroke={item.color}
                strokeWidth={item.key === "score" ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            <path
              d={linePath(data, (point) => point.rank, (value) =>
                rankY(value, rankMax),
              )}
              fill="none"
              stroke="#7c3aed"
              strokeWidth="2.5"
              strokeDasharray="7 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {series.map((item) =>
              data.map((point, index) => {
                const value = point[item.key];
                if (value === null) return null;
                return (
                  <circle
                    key={`${item.key}-${point.year}`}
                    cx={xPosition(index, data.length)}
                    cy={scoreY(value)}
                    r={activeIndex === index ? 4.5 : 3}
                    fill="var(--color-card)"
                    stroke={item.color}
                    strokeWidth="2"
                    className="transition-[r] duration-150"
                    pointerEvents="none"
                  />
                );
              }),
            )}
            {data.map((point, index) =>
              point.rank === null ? null : (
                <circle
                  key={`rank-${point.year}`}
                  cx={xPosition(index, data.length)}
                  cy={rankY(point.rank, rankMax)}
                  r={activeIndex === index ? 4.5 : 3}
                  fill="var(--color-card)"
                  stroke="#7c3aed"
                  strokeWidth="2"
                  className="transition-[r] duration-150"
                  pointerEvents="none"
                />
              ),
            )}

            {activeIndex !== null && (
              <line
                x1={activeX}
                x2={activeX}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                className="stroke-foreground/25"
                strokeWidth="1"
                strokeDasharray="3 4"
                pointerEvents="none"
              />
            )}

            {data.map((point, index) => {
              const x = xPosition(index, data.length);
              const bandWidth =
                data.length > 1 ? PLOT_WIDTH / (data.length - 1) : PLOT_WIDTH;
              return (
                <g key={point.year}>
                  <rect
                    x={Math.max(MARGIN.left, x - bandWidth / 2)}
                    y={MARGIN.top}
                    width={
                      index === 0 || index === data.length - 1
                        ? bandWidth / 2
                        : bandWidth
                    }
                    height={PLOT_HEIGHT}
                    fill="transparent"
                    pointerEvents="none"
                  />
                  <text
                    x={x}
                    y={HEIGHT - 16}
                    textAnchor="middle"
                    className={cn(
                      "fill-muted-foreground text-xs font-medium tabular-nums",
                      activeIndex === index && "fill-foreground",
                    )}
                    pointerEvents="none"
                  >
                    {point.year}
                    {point.partial ? "*" : ""}
                  </text>
                </g>
              );
            })}
          </svg>

          {data.map((point, index) => {
            const x = xPosition(index, data.length);
            const bandWidth =
              data.length > 1 ? PLOT_WIDTH / (data.length - 1) : PLOT_WIDTH;
            const width =
              index === 0 || index === data.length - 1
                ? bandWidth / 2
                : bandWidth;
            const left =
              index === 0 ? MARGIN.left : Math.max(MARGIN.left, x - width / 2);
            return (
              <button
                key={`interaction-${point.year}`}
                type="button"
                className="group/year absolute rounded-sm bg-transparent text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                style={{
                  left: `${(left / WIDTH) * 100}%`,
                  top: `${(MARGIN.top / HEIGHT) * 100}%`,
                  width: `${(width / WIDTH) * 100}%`,
                  height: `${(PLOT_HEIGHT / HEIGHT) * 100}%`,
                }}
                aria-label={pointAriaLabel(
                  point,
                  productionLabel,
                  resourcesLabel,
                )}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              >
                <span
                  className={cn(
                    "pointer-events-none absolute top-2 z-10 w-56 rounded-lg bg-foreground p-3 text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover/year:opacity-100 group-focus/year:opacity-100",
                    index === 0
                      ? "left-0"
                      : index === data.length - 1
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2",
                  )}
                  role="tooltip"
                >
                  <span className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-semibold tabular-nums">
                      {point.year}
                      {point.partial ? "*" : ""}
                    </span>
                    <span className="text-xs opacity-70 tabular-nums">
                      {formatRank(point.rank)}
                    </span>
                  </span>
                  <span className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-xs tabular-nums">
                    {series.map((item) => (
                      <span className="contents" key={item.key}>
                        <span className="flex items-center gap-2 opacity-80">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                            aria-hidden="true"
                          />
                          {item.label}
                        </span>
                        <span className="font-medium">
                          {formatValue(point[item.key])}
                        </span>
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  dashed = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="24" height="8" aria-hidden="true">
        <line
          x1="1"
          x2="23"
          y1="4"
          y2="4"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? "5 3" : undefined}
          strokeLinecap="round"
        />
      </svg>
      {label}
    </span>
  );
}

function xPosition(index: number, length: number) {
  if (length <= 1) return MARGIN.left + PLOT_WIDTH / 2;
  return MARGIN.left + (index / (length - 1)) * PLOT_WIDTH;
}

function scoreY(value: number) {
  return MARGIN.top + ((100 - value) / 100) * PLOT_HEIGHT;
}

function rankY(value: number, max: number) {
  if (max <= 1) return MARGIN.top;
  return MARGIN.top + ((value - 1) / (max - 1)) * PLOT_HEIGHT;
}

function linePath(
  data: AnnualEvolutionPoint[],
  valueFor: (point: AnnualEvolutionPoint) => number | null,
  yFor: (value: number) => number,
) {
  let drawing = false;
  return data
    .map((point, index) => {
      const value = valueFor(point);
      if (value === null) {
        drawing = false;
        return "";
      }
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command} ${xPosition(index, data.length)} ${yFor(value)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function formatValue(value: number | null) {
  return value === null ? "N/D" : String(value);
}

function formatRank(rank: number | null) {
  return rank === null ? "Sem posição" : `${rank}º lugar`;
}

function pointAriaLabel(
  point: AnnualEvolutionPoint,
  productionLabel: string,
  resourcesLabel: string,
) {
  return [
    `${point.year}${point.partial ? ", ano em andamento" : ""}`,
    formatRank(point.rank),
    `score ${formatValue(point.score)}`,
    `participação ${formatValue(point.participation)}`,
    `${productionLabel.toLowerCase()} ${formatValue(point.production)}`,
    `${resourcesLabel.toLowerCase()} ${formatValue(point.resources)}`,
    `${PUBLIC_VALUE_DIMENSION_LABELS.campaignFinance.toLocaleLowerCase("pt-BR")} ${formatValue(point.campaignFinance)}`,
  ].join(", ");
}
