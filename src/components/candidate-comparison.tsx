"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Check,
  Search,
  X,
} from "lucide-react";
import { DimensionScore } from "@/components/dimension-score";
import { SemanticScore } from "@/components/semantic-score";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateComparisonDifference,
  type ComparisonCandidate,
} from "@/lib/comparison";
import { formatCurrency, type RankingIndex } from "@/lib/ranking";
import { cn } from "@/lib/utils";

export type ComparisonOption = {
  slug: string;
  name: string;
  civilName: string;
  party: string;
  state: string;
  electionNumber: string | null;
};

type PeriodOption = {
  id: string;
  label: string;
  partial: boolean;
};

export function CandidateComparison({
  options,
  periods,
  period,
  index,
  selectedA,
  selectedB,
  candidateA,
  candidateB,
  invalidA,
  invalidB,
}: {
  options: ComparisonOption[];
  periods: PeriodOption[];
  period: string;
  index: RankingIndex;
  selectedA: string | null;
  selectedB: string | null;
  candidateA: ComparisonCandidate | null;
  candidateB: ComparisonCandidate | null;
  invalidA: boolean;
  invalidB: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(next: {
    a?: string | null;
    b?: string | null;
    period?: string;
    index?: RankingIndex;
  }) {
    const params = new URLSearchParams();
    const a = next.a === undefined ? selectedA : next.a;
    const b = next.b === undefined ? selectedB : next.b;
    const nextPeriod = next.period ?? period;
    const nextIndex = next.index ?? index;

    if (a) params.set("a", a);
    if (b) params.set("b", b);
    params.set("periodo", nextPeriod);
    params.set("indice", nextIndex === "public-value" ? "valor-publico" : "atual");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-visible">
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)_180px_220px] lg:items-end">
          <CandidatePicker
            key={`candidate-a-${selectedA || "empty"}-${period}`}
            label="Candidato A"
            options={options}
            selectedSlug={invalidA ? null : selectedA}
            excludedSlug={selectedB}
            invalid={invalidA}
            onSelect={(slug) => navigate({ a: slug })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="mx-auto hidden size-10 lg:inline-flex"
            disabled={!selectedA && !selectedB}
            onClick={() => navigate({ a: selectedB, b: selectedA })}
            aria-label="Trocar candidatos"
          >
            <ArrowLeftRight className="size-4" />
          </Button>
          <CandidatePicker
            key={`candidate-b-${selectedB || "empty"}-${period}`}
            label="Candidato B"
            options={options}
            selectedSlug={invalidB ? null : selectedB}
            excludedSlug={selectedA}
            invalid={invalidB}
            onSelect={(slug) => navigate({ b: slug })}
          />
          <ControlField label="Período">
            <Select
              value={period}
              onValueChange={(value) =>
                navigate({ period: value ?? periods[0]?.id ?? period })
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue>
                  {periods.find((item) => item.id === period)?.label || period}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ControlField>
          <ControlField label="Índice">
            <Select
              value={index}
              onValueChange={(value) =>
                navigate({
                  index: (value ?? "current") as RankingIndex,
                })
              }
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue>
                  {index === "public-value"
                    ? "Valor Público"
                    : "Índice atual"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Índice atual</SelectItem>
                <SelectItem value="public-value">
                  Valor Público (experimental)
                </SelectItem>
              </SelectContent>
            </Select>
          </ControlField>
          <Button
            type="button"
            variant="outline"
            className="h-10 lg:hidden"
            disabled={!selectedA && !selectedB}
            onClick={() => navigate({ a: selectedB, b: selectedA })}
          >
            <ArrowLeftRight className="size-4" /> Trocar lados
          </Button>
        </CardContent>
      </Card>

      {invalidA || invalidB ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Um dos candidatos informados não possui registro em{" "}
          {periods.find((item) => item.id === period)?.label || period}. Escolha
          outro nome para continuar.
        </div>
      ) : null}

      {!candidateA && !candidateB ? (
        <EmptyComparison />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <CandidateHero
              candidate={candidateA}
              side="A"
              index={index}
              period={period}
            />
            <CandidateHero
              candidate={candidateB}
              side="B"
              index={index}
              period={period}
            />
          </div>

          {candidateA && candidateB ? (
            <ComparisonSections
              candidateA={candidateA}
              candidateB={candidateB}
              index={index}
            />
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">Escolha o segundo candidato</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A comparação das métricas aparecerá assim que os dois lados
                estiverem preenchidos.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CandidatePicker({
  label,
  options,
  selectedSlug,
  excludedSlug,
  invalid,
  onSelect,
}: {
  label: string;
  options: ComparisonOption[];
  selectedSlug: string | null;
  excludedSlug: string | null;
  invalid: boolean;
  onSelect: (slug: string | null) => void;
}) {
  const selected = options.find((option) => option.slug === selectedSlug) || null;
  const pickerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(selected?.name || "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  const filtered = useMemo(() => {
    const normalized = normalize(query);
    return options
      .filter((option) => option.slug !== excludedSlug)
      .filter((option) => {
        if (!normalized) return true;
        return normalize(
          [
            option.name,
            option.civilName,
            option.party,
            option.state,
            option.electionNumber || "",
          ].join(" "),
        ).includes(normalized);
      })
      .slice(0, 10);
  }, [excludedSlug, options, query]);

  function choose(option: ComparisonOption) {
    setQuery(option.name);
    setOpen(false);
    onSelect(option.slug);
  }

  return (
    <ControlField label={label}>
      <div ref={pickerRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder="Buscar nome, partido ou número"
          className={cn("h-10 px-9", invalid && "border-amber-500")}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${label}-options`}
          aria-autocomplete="list"
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) =>
                Math.min(current + 1, filtered.length - 1),
              );
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter" && open && filtered[activeIndex]) {
              event.preventDefault();
              choose(filtered[activeIndex]);
            }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {query ? (
          <button
            type="button"
            className="absolute right-0 top-0 flex size-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              setOpen(true);
              onSelect(null);
            }}
            aria-label={`Limpar ${label.toLocaleLowerCase("pt-BR")}`}
          >
            <X className="size-4" />
          </button>
        ) : null}
        {open ? (
          <div
            id={`${label}-options`}
            role="listbox"
            className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-foreground/10"
          >
            {filtered.length ? (
              filtered.map((option, optionIndex) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.slug === selectedSlug}
                  key={option.slug}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    optionIndex === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(optionIndex)}
                  onClick={() => choose(option)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {option.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.party}/{option.state}
                      {option.electionNumber
                        ? ` · nº ${option.electionNumber}`
                        : ""}
                    </span>
                  </span>
                  {option.slug === selectedSlug ? (
                    <Check className="size-4 shrink-0" />
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum candidato encontrado.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </ControlField>
  );
}

function CandidateHero({
  candidate,
  side,
  index,
  period,
}: {
  candidate: ComparisonCandidate | null;
  side: "A" | "B";
  index: RankingIndex;
  period: string;
}) {
  if (!candidate) {
    return (
      <Card className="min-h-64 border-dashed bg-muted/20 ring-0">
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <Search className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Candidato {side}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use a busca acima para preencher este lado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center text-center">
        <div className="relative size-24 overflow-hidden rounded-xl bg-muted outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
          <Image
            src={candidate.photoUrl}
            alt={`Foto oficial de ${candidate.name}`}
            fill
            sizes="96px"
            className="object-cover object-top"
          />
        </div>
        <Badge variant="secondary" className="mt-4">
          Candidato {side}
        </Badge>
        <Link
          href={`/candidatos/${candidate.slug}?periodo=${encodeURIComponent(
            period,
          )}&indice=${index === "public-value" ? "valor-publico" : "atual"}`}
          className="mt-2 text-xl font-semibold tracking-tight hover:underline"
        >
          {candidate.name}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          {candidate.party}/{candidate.state} · desde{" "}
          {formatDate(candidate.officeStart)}
        </p>
        <div className="mt-5 flex items-center gap-4">
          <SemanticScore value={candidate.score} index={index} compact />
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Posição no Brasil</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {candidate.rank ? `${candidate.rank}º` : "Sem posição"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonSections({
  candidateA,
  candidateB,
  index,
}: {
  candidateA: ComparisonCandidate;
  candidateB: ComparisonCandidate;
  index: RankingIndex;
}) {
  return (
    <div className="space-y-5">
      <ComparisonSection
        title="Resultado do índice"
        description="Cores representam a faixa de qualidade definida na metodologia."
      >
        {candidateA.dimensions.map((dimension, dimensionIndex) => (
          <div
            key={dimension.key}
            className="grid gap-3 border-b py-4 first:pt-0 last:border-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)] md:items-center"
          >
            <DimensionScore
              label={`${dimension.label} · ${candidateA.name}`}
              value={dimension.value}
              index={index}
            />
            <DifferenceLabel
              left={dimension.value}
              right={candidateB.dimensions[dimensionIndex]?.value ?? null}
              format="points"
            />
            <DimensionScore
              label={`${dimension.label} · ${candidateB.name}`}
              value={candidateB.dimensions[dimensionIndex]?.value ?? null}
              index={index}
            />
          </div>
        ))}
      </ComparisonSection>

      <MetricSection
        title="Atividade parlamentar"
        description="Registros publicados pela Câmara no período selecionado."
        leftName={candidateA.name}
        rightName={candidateB.name}
        rows={[
          metric("Presenças em sessões", candidateA.activity.plenaryAttendances, candidateB.activity.plenaryAttendances, "number", "higher"),
          metric("Votos nominais", candidateA.activity.nominalVotes, candidateB.activity.nominalVotes, "number", "higher"),
          metric("Propostas substantivas", candidateA.activity.substantiveProposals, candidateB.activity.substantiveProposals, "number", "higher"),
          metric("Propostas de fiscalização", candidateA.activity.oversightProposals, candidateB.activity.oversightProposals, "number", "higher"),
          metric("Propostas que avançaram", candidateA.activity.advancedProposals, candidateB.activity.advancedProposals, "number", "higher"),
          metric("Transformadas em norma", candidateA.activity.convertedProposals, candidateB.activity.convertedProposals, "number", "higher"),
        ]}
      />

      <MetricSection
        title="Cota parlamentar"
        description="Despesas líquidas da CEAP; valores maiores ou menores não são classificados isoladamente como melhores."
        leftName={candidateA.name}
        rightName={candidateB.name}
        rows={[
          metric("Total gasto", candidateA.expenses.total, candidateB.expenses.total, "currency", "lower"),
          metric("Média por mês em exercício", candidateA.expenses.monthlyAverage, candidateB.expenses.monthlyAverage, "currency", "lower"),
          metric("Documentos publicados", candidateA.expenses.documents, candidateB.expenses.documents),
          metric("Concentração por fornecedor", candidateA.expenses.supplierConcentration, candidateB.expenses.supplierConcentration, "ratio", "lower"),
          textMetric("Principal categoria", candidateA.expenses.topCategory, candidateB.expenses.topCategory),
          textMetric("Maior fornecedor", candidateA.expenses.topSupplier, candidateB.expenses.topSupplier),
        ]}
      />

      <MetricSection
        title="Emendas disponíveis"
        description="Somente os maiores registros exibidos no arquivo atual são somados."
        leftName={candidateA.name}
        rightName={candidateB.name}
        rows={[
          metric("Registros exibidos", candidateA.amendments.count, candidateB.amendments.count),
          metric("Valor indicado", candidateA.amendments.proposedValue, candidateB.amendments.proposedValue, "currency"),
          metric("Valor transferido", candidateA.amendments.transferredValue, candidateB.amendments.transferredValue, "currency"),
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricSection
          title="Patrimônio declarado"
          description="Bens informados ao TSE na candidatura de 2022."
          leftName={candidateA.name}
          rightName={candidateB.name}
          rows={[
            metric("Total declarado", candidateA.assets.total, candidateB.assets.total, "currency"),
            metric("Bens declarados", candidateA.assets.count, candidateB.assets.count),
          ]}
        />
        <MetricSection
          title="Equipe do gabinete"
          description="Retrato atual dos secretários parlamentares publicados pela Câmara."
          leftName={candidateA.name}
          rightName={candidateB.name}
          rows={[
            metric("Pessoas na equipe", candidateA.staffCount, candidateB.staffCount),
          ]}
        />
      </div>
    </div>
  );
}

type MetricRow = {
  label: string;
  left: number | string | null;
  right: number | string | null;
  format: "number" | "currency" | "ratio" | "text";
  preference: "higher" | "lower" | "neutral";
};

function MetricSection({
  title,
  description,
  leftName,
  rightName,
  rows,
}: {
  title: string;
  description: string;
  leftName: string;
  rightName: string;
  rows: MetricRow[];
}) {
  return (
    <ComparisonSection title={title} description={description}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b pb-3 text-xs font-medium text-muted-foreground md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)]">
        <span className="truncate text-right">{leftName}</span>
        <span className="hidden text-center md:block">Métrica</span>
        <span className="truncate text-right md:text-left">{rightName}</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 border-b py-4 last:border-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] md:items-center"
        >
          <MetricValue
            value={row.left}
            format={row.format}
            bad={isWorseValue(row.left, row.right, row.preference)}
            className="row-start-2 text-right md:row-auto"
          />
          <div className="col-span-2 row-start-1 text-center md:col-span-1 md:col-start-2 md:row-auto">
            <p className="text-xs font-medium text-muted-foreground">
              {row.label}
            </p>
            {typeof row.left === "number" && typeof row.right === "number" ? (
              <DifferenceLabel
                left={row.left}
                right={row.right}
                format={
                  row.format === "currency"
                    ? "currency"
                    : row.format === "ratio"
                      ? "percentagePoints"
                      : "number"
                }
              />
            ) : null}
          </div>
          <MetricValue
            value={row.right}
            format={row.format}
            bad={isWorseValue(row.right, row.left, row.preference)}
            className="row-start-2 text-right md:row-auto md:text-left"
          />
        </div>
      ))}
    </ComparisonSection>
  );
}

function ComparisonSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricValue({
  value,
  format,
  bad = false,
  className,
}: {
  value: number | string | null;
  format: MetricRow["format"];
  bad?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "min-w-0 text-base font-semibold tabular-nums text-pretty",
        bad && "text-red-700 dark:text-red-400",
        className,
      )}
    >
      {formatMetricValue(value, format)}
    </p>
  );
}

function DifferenceLabel({
  left,
  right,
  format,
}: {
  left: number | null;
  right: number | null;
  format: "number" | "currency" | "points" | "percentagePoints";
}) {
  const difference = calculateComparisonDifference(left, right);
  if (!difference) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground">
        Diferença indisponível
      </p>
    );
  }

  const absolute =
    format === "currency"
      ? formatCurrency(difference.absolute)
      : format === "percentagePoints"
        ? `${Math.round(difference.absolute * 100)} p.p.`
        : format === "points"
          ? `${Math.round(difference.absolute)} pontos`
          : new Intl.NumberFormat("pt-BR", {
              maximumFractionDigits: 1,
            }).format(difference.absolute);
  const percent =
    difference.percent === null || difference.absolute === 0
      ? ""
      : ` · ${Math.round(difference.percent)}%`;

  return (
    <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
      Diferença: {absolute}
      {percent}
    </p>
  );
}

function ControlField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyComparison() {
  return (
    <Card className="border-dashed bg-muted/20 ring-0">
      <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-foreground/10">
          <ArrowLeftRight className="size-5" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-balance">
          Escolha dois candidatos para comparar
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground text-pretty">
          Pesquise por nome, partido, estado ou número eleitoral. As métricas
          serão calculadas no mesmo período e com a mesma metodologia.
        </p>
      </CardContent>
    </Card>
  );
}

function metric(
  label: string,
  left: number | null,
  right: number | null,
  format: MetricRow["format"] = "number",
  preference: MetricRow["preference"] = "neutral",
): MetricRow {
  return { label, left, right, format, preference };
}

function textMetric(
  label: string,
  left: string | null,
  right: string | null,
): MetricRow {
  return { label, left, right, format: "text", preference: "neutral" };
}

function isWorseValue(
  value: number | string | null,
  other: number | string | null,
  preference: MetricRow["preference"],
) {
  if (
    preference === "neutral" ||
    typeof value !== "number" ||
    typeof other !== "number" ||
    value === other
  ) {
    return false;
  }
  return preference === "higher" ? value < other : value > other;
}

function formatMetricValue(
  value: number | string | null,
  format: MetricRow["format"],
) {
  if (value === null) return "Dados indisponíveis";
  if (typeof value === "string") return value;
  if (format === "currency") return formatCurrency(value);
  if (format === "ratio") return `${Math.round(value * 100)}%`;
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${value}T12:00:00`),
  );
}
