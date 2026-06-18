"use client"

import { useState } from "react"
import { ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/ranking"
import { DataTable, type Column, type FilterDef } from "@/components/data-table"

/* ───── helpers ───── */

function formatDate(value: string) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`))
}

function formatDecimal(value: number | null | undefined) {
  return value === null || value === undefined
    ? "Dados indisponíveis"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)
}

function publicVoteClassificationLabel(value: string) {
  if (value === "unanalyzed") return "não analisado"
  if (value === "analyzed") return "analisado"
  if (value === "positive_public_interest") return "interesse público"
  if (value === "low_relevance") return "baixa relevância"
  if (value === "negative_public_interest") return "negativa"
  if (value === "harmful_or_self_serving") return "auto-benefício"
  return "neutra"
}

function severityLabel(value: string) {
  if (!value) return "-"
  if (value === "critical") return "crítica"
  if (value === "high") return "alta"
  if (value === "medium") return "média"
  return "baixa"
}

function severityPoints(value: string) {
  if (!value) return 0
  if (value === "critical") return 30
  if (value === "high") return 18
  if (value === "medium") return 10
  return 4
}

function candidateVoteLabel(value: string) {
  if (value === "yes") return "sim"
  if (value === "no") return "não"
  if (value === "absent") return "ausente"
  return "abstenção"
}

const CLASSIFICATION_STYLES: Record<string, string> = {
  unanalyzed: "border-muted bg-muted text-muted-foreground",
  analyzed: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400",
  positive_public_interest: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400",
  neutral: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  low_relevance: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  negative_public_interest: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400",
  harmful_or_self_serving: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  high: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400",
  medium: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-400",
  low: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
}

const VOTE_BAR_SEGMENTS: {
  key: string
  label: string
  barClass: string
  dotClass: string
}[] = [
  {
    key: "positive_public_interest",
    label: "Interesse público",
    barClass: "bg-emerald-500 dark:bg-emerald-400",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
  {
    key: "neutral",
    label: "Neutra",
    barClass: "bg-gray-400 dark:bg-gray-500",
    dotClass: "bg-gray-400 dark:bg-gray-500",
  },
  {
    key: "low_relevance",
    label: "Baixa relevância",
    barClass: "bg-slate-400 dark:bg-slate-500",
    dotClass: "bg-slate-400 dark:bg-slate-500",
  },
  {
    key: "negative_public_interest",
    label: "Negativa",
    barClass: "bg-amber-500 dark:bg-amber-400",
    dotClass: "bg-amber-500 dark:bg-amber-400",
  },
  {
    key: "harmful_or_self_serving",
    label: "Auto-benefício",
    barClass: "bg-red-500 dark:bg-red-400",
    dotClass: "bg-red-500 dark:bg-red-400",
  },
]

/* ───── types ───── */

type ExpenseCategory = { name: string; total: number; documents: number }
type Supplier = { name: string; taxId: string | null; total: number; documents: number }
type LargestExpense = { category: string; supplier: string; date: string; value: number; documentUrl: string | null }
type PublicVote = { voteId: string; date: string; description: string; summary: string; url: string; candidateVote: string; classification: string; severity: string; scoreDelta: number; confidence: number | null; reason: string; source: string; reviewedManually: boolean }
type Amendment = { number: string; year: string; type: string; beneficiary: string; proposedValue: number; transferredValue: number }
type Asset = { type: string; description: string; value: number }
type CampaignDonor = { name: string; value: number }
type CampaignSupplier = { name: string; value: number }

/* ───── tables ───── */

export function VoteDistributionBar({ data }: { data: PublicVote[] }) {
  const segments = VOTE_BAR_SEGMENTS.map((s) => ({
    ...s,
    count: data.filter((v) => v.classification === s.key).length,
  }))
  const total = segments.reduce((sum, s) => sum + s.count, 0)

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma votação classificada no período.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((s) => {
          const pct = (s.count / total) * 100
          if (pct < 0.5) return null
          return (
            <div
              key={s.key}
              className={cn(s.barClass, "transition-all duration-500")}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.count} (${Math.round(pct)}%)`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {segments.map((s) =>
          s.count > 0 ? (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", s.dotClass)} />
              <span className="tabular-nums font-medium">{s.count}</span>
              <span className="text-muted-foreground">{s.label}</span>
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

function VoteDetailSheet({
  vote,
  open,
  onOpenChange,
}: {
  vote: PublicVote | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!vote) return null

  const analyzed = vote.classification !== "unanalyzed"
  const aligned =
    vote.classification === "positive_public_interest" || vote.classification === "neutral"
      ? vote.candidateVote === "yes"
      : vote.candidateVote === "no"
  const points = severityPoints(vote.severity)
  const methodLabel =
    !analyzed ? "Não analisada" : vote.source === "reviewed" ? "Revisão manual" : "Regra automática"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-base">
            Votação {vote.voteId}
          </SheetTitle>
          <SheetDescription>
            {analyzed
              ? "Detalhes completos da votação e do impacto no score"
              : "Esta votação ainda não entrou no cálculo do score"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 p-4 pt-5">
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Descrição
            </h4>
            <p className="text-sm leading-relaxed text-foreground">
              {vote.description}
            </p>
          </section>

          {vote.summary && (
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Resumo
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {vote.summary}
              </p>
            </section>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Data
              </h4>
              <p className="text-sm">{formatDate(vote.date)}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Voto do parlamentar
              </h4>
              <p className="text-sm font-medium">{candidateVoteLabel(vote.candidateVote)}</p>
            </div>
          </div>

          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Classificação
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="secondary"
                className={cn("text-[11px]", CLASSIFICATION_STYLES[vote.classification] || "")}
              >
                {publicVoteClassificationLabel(vote.classification)}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[11px]", SEVERITY_STYLES[vote.severity] || "")}
              >
                {severityLabel(vote.severity)}
              </Badge>
              {vote.reviewedManually && (
                <Badge variant="outline" className="text-[11px]">Revisado manualmente</Badge>
              )}
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Justificativa
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {vote.reason || "Esta votação ainda não foi classificada pela metodologia de valor público."}
            </p>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Impacto no score
            </h4>
            <div className="space-y-1">
              <p className="text-lg font-semibold tabular-nums">
                {vote.scoreDelta > 0 ? "+" : ""}{formatDecimal(vote.scoreDelta)} pts
              </p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {analyzed ? (
                  <>
                    {vote.severity ? (
                      <li>Pontos base da severidade ({severityLabel(vote.severity)}): {points}</li>
                    ) : (
                      <li>Classificação detalhada indisponível neste registro.</li>
                    )}
                    {vote.candidateVote === "absent" && (
                      <li>Ausência em votação de severidade {severityLabel(vote.severity)}</li>
                    )}
                    {vote.severity && vote.candidateVote !== "absent" && vote.candidateVote !== "abstain" && (
                      <li>Voto {aligned ? "alinhado" : "contrário"} ao interesse público</li>
                    )}
                    <li>
                      Confiança da classificação:{" "}
                      {vote.confidence === null ? "Dados indisponíveis" : `${formatDecimal(vote.confidence * 100)}%`}
                    </li>
                  </>
                ) : (
                  <li>Esta votação ainda não entrou no cálculo do score.</li>
                )}
                <li>Metodologia: {methodLabel}</li>
              </ul>
            </div>
          </section>

          <div className="pt-2">
            <a
              href={vote.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full gap-2",
              )}
            >
              <ExternalLink className="size-3.5" />
              Abrir na Câmara
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ───── remaining tables ───── */

export function ExpenseCategoriesTable({ data }: { data: ExpenseCategory[] }) {
  return (
    <DataTable
      columns={[
        { id: "categoria", header: "Categoria", sortable: true, sortValue: (i) => i.name, cell: (i) => <span className="font-medium">{i.name}</span> },
        { id: "total", header: "Total", sortable: true, sortValue: (i) => i.total, className: "w-[150px]", headerClassName: "w-[150px] text-right", cell: (i) => <span className="block text-right font-semibold tabular-nums">{formatCurrency(i.total)}</span> },
        { id: "documentos", header: "Documentos", sortable: true, sortValue: (i) => i.documents, className: "w-[120px]", headerClassName: "w-[120px] text-right", cell: (i) => <span className="block text-right text-xs text-muted-foreground tabular-nums">{i.documents}</span> },
      ]}
      data={data}
      keyFn={(i, idx) => `${i.name}-${idx}`}
      searchable={false}
      itemsPerPage={10}
      emptyMessage="Nenhuma categoria encontrada."
    />
  )
}

export function SuppliersTable({ data }: { data: Supplier[] }) {
  return (
    <DataTable
      columns={[
        { id: "fornecedor", header: "Fornecedor", sortable: true, sortValue: (i) => i.name, cell: (i) => <span className="font-medium">{i.name}</span> },
        { id: "cnpj", header: "CNPJ/CPF", sortable: true, sortValue: (i) => i.taxId ?? "", className: "w-[150px]", headerClassName: "w-[150px]", cell: (i) => <span className="text-xs text-muted-foreground tabular-nums">{i.taxId ?? "—"}</span> },
        { id: "total", header: "Total", sortable: true, sortValue: (i) => i.total, className: "w-[150px]", headerClassName: "w-[150px] text-right", cell: (i) => <span className="block text-right font-semibold tabular-nums">{formatCurrency(i.total)}</span> },
        { id: "documentos", header: "Documentos", sortable: true, sortValue: (i) => i.documents, className: "w-[120px]", headerClassName: "w-[120px] text-right", cell: (i) => <span className="block text-right text-xs text-muted-foreground tabular-nums">{i.documents}</span> },
      ]}
      data={data}
      keyFn={(i, idx) => `${i.taxId ?? i.name}-${idx}`}
      searchable
      searchPlaceholder="Buscar por fornecedor ou CNPJ..."
      searchFields={[(i) => i.name, (i) => i.taxId ?? ""]}
      emptyMessage="Nenhum fornecedor encontrado."
    />
  )
}

export function LargestExpensesTable({ data }: { data: LargestExpense[] }) {
  return (
    <DataTable
      columns={[
        { id: "categoria", header: "Categoria", sortable: true, sortValue: (i) => i.category, cell: (i) => <span className="font-medium">{i.category}</span> },
        { id: "fornecedor", header: "Fornecedor", sortable: true, sortValue: (i) => i.supplier, cell: (i) => <span className="text-xs text-muted-foreground">{i.supplier}</span> },
        { id: "data", header: "Data", sortable: true, sortValue: (i) => i.date, className: "w-[100px]", headerClassName: "w-[100px]", cell: (i) => <span className="text-xs text-muted-foreground">{formatDate(i.date)}</span> },
        { id: "valor", header: "Valor", sortable: true, sortValue: (i) => i.value, className: "w-[140px]", headerClassName: "w-[140px] text-right", cell: (i) => <span className="block text-right font-semibold tabular-nums">{formatCurrency(i.value)}</span> },
        { id: "documento", header: "Documento", className: "w-[90px]", headerClassName: "w-[90px]", cell: (i) => i.documentUrl ? (
          <a href={i.documentUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "xs" })}>Nota <ExternalLink className="size-3" /></a>
        ) : null },
      ]}
      data={data}
      keyFn={(i, idx) => `${i.date}-${i.supplier}-${i.value}-${i.category}-${idx}`}
      searchable
      searchPlaceholder="Buscar por categoria ou fornecedor..."
      searchFields={[(i) => i.category, (i) => i.supplier]}
      emptyMessage="Nenhuma despesa encontrada."
    />
  )
}

export function PublicVotesTable({ data }: { data: PublicVote[] }) {
  const [selected, setSelected] = useState<PublicVote | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function openSheet(vote: PublicVote) {
    setSelected(vote)
    setSheetOpen(true)
  }

  const filters: FilterDef<PublicVote>[] = [
    {
      id: "status",
      label: "Status",
      options: [
        { value: "analyzed", label: "Analisados" },
        { value: "unanalyzed", label: "Não analisados" },
      ],
      getValue: (vote) => vote.classification === "unanalyzed" ? "unanalyzed" : "analyzed",
    },
    {
      id: "classification",
      label: "Classificação",
      options: [
        { value: "positive_public_interest", label: "Interesse público" },
        { value: "low_relevance", label: "Baixa relevância" },
        { value: "negative_public_interest", label: "Negativa" },
        { value: "harmful_or_self_serving", label: "Auto-benefício" },
        { value: "neutral", label: "Neutra" },
        { value: "analyzed", label: "Analisada" },
      ],
      getValue: (vote) => vote.classification,
    },
    {
      id: "candidateVote",
      label: "Voto",
      options: [
        { value: "yes", label: "Sim" },
        { value: "no", label: "Não" },
        { value: "absent", label: "Ausente" },
        { value: "abstain", label: "Abstenção" },
      ],
      getValue: (vote) => vote.candidateVote,
    },
    {
      id: "severity",
      label: "Severidade",
      options: [
        { value: "critical", label: "Crítica" },
        { value: "high", label: "Alta" },
        { value: "medium", label: "Média" },
        { value: "low", label: "Baixa" },
      ],
      getValue: (vote) => vote.severity,
    },
  ]

  const columns: Column<PublicVote>[] = [
    {
      id: "votacao",
      header: "Votação",
      sortable: true,
      sortValue: (vote) => `${vote.date} ${vote.description}`,
      className: "w-[34%] whitespace-normal",
      headerClassName: "w-[34%]",
      cell: (vote) => (
        <div>
          <button
            type="button"
            onClick={() => openSheet(vote)}
            className="inline-flex items-center gap-1 text-left text-sm font-medium underline-offset-2 hover:underline"
          >
            {vote.voteId}
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
          </button>
          <p className="mt-0.5 line-clamp-3 text-pretty text-xs leading-relaxed text-muted-foreground">
            {vote.description}
          </p>
          <button
            type="button"
            onClick={() => openSheet(vote)}
            className="mt-0.5 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            Ver detalhes da votação
          </button>
        </div>
      ),
    },
    {
      id: "voto",
      header: "Voto",
      sortable: true,
      sortValue: (vote) => candidateVoteLabel(vote.candidateVote),
      className: "w-[82px]",
      headerClassName: "w-[82px]",
      cell: (vote) => (
        <span className="text-xs font-medium">{candidateVoteLabel(vote.candidateVote)}</span>
      ),
    },
    {
      id: "classificacao",
      header: "Classificação",
      sortable: true,
      sortValue: (vote) => publicVoteClassificationLabel(vote.classification),
      className: "w-[150px]",
      headerClassName: "w-[150px]",
      cell: (vote) => (
        <Badge
          variant="secondary"
          className={cn("inline-flex max-w-full items-center gap-1 text-[10px]", CLASSIFICATION_STYLES[vote.classification] || "")}
        >
          <span className="min-w-0 truncate">
            {publicVoteClassificationLabel(vote.classification)}
          </span>
        </Badge>
      ),
    },
    {
      id: "severidade",
      header: "Severidade",
      sortable: true,
      sortValue: (vote) => severityLabel(vote.severity),
      className: "w-[110px]",
      headerClassName: "w-[110px]",
      cell: (vote) => (
        <Badge
          variant="outline"
          className={cn("inline-flex max-w-full items-center gap-1 text-[10px]", SEVERITY_STYLES[vote.severity] || "")}
        >
          <span className="min-w-0 truncate">{severityLabel(vote.severity)}</span>
        </Badge>
      ),
    },
    {
      id: "impacto",
      header: "Impacto",
      sortable: true,
      sortValue: (vote) => vote.scoreDelta,
      className: "w-[82px]",
      headerClassName: "w-[82px]",
      cell: (vote) => (
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            vote.scoreDelta < 0
              ? "text-red-700 dark:text-red-400"
              : vote.scoreDelta > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-muted-foreground",
          )}
        >
          {vote.scoreDelta > 0 ? "+" : ""}{formatDecimal(vote.scoreDelta)}
        </span>
      ),
    },
    {
      id: "data",
      header: "Data",
      sortable: true,
      sortValue: (vote) => vote.date,
      className: "w-[82px]",
      headerClassName: "w-[82px]",
      cell: (vote) => (
        <span className="text-xs text-muted-foreground">{formatDate(vote.date)}</span>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        keyFn={(vote, idx) => `${vote.voteId}-${vote.candidateVote}-${idx}`}
        searchable
        searchPlaceholder="Buscar por descrição ou resumo..."
        searchFields={[
          (vote) => vote.description,
          (vote) => vote.summary ?? "",
          (vote) => vote.voteId,
          (vote) => vote.reason,
        ]}
        filters={filters}
        emptyMessage="Nenhuma votação nominal encontrada no período."
        tableClassName="table-fixed"
      />
      <VoteDetailSheet vote={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}

export function AmendmentsTable({ data }: { data: Amendment[] }) {
  return (
    <DataTable
      columns={[
        { id: "emenda", header: "Emenda", sortable: true, sortValue: (i) => i.number, cell: (i) => <span className="font-medium">Emenda {i.number} · {i.type}</span> },
        { id: "beneficiario", header: "Beneficiário", sortable: true, sortValue: (i) => i.beneficiary, cell: (i) => <span className="text-xs text-muted-foreground">{i.beneficiary}</span> },
        { id: "indicado", header: "Indicado", sortable: true, sortValue: (i) => i.proposedValue, className: "w-[140px]", headerClassName: "w-[140px] text-right", cell: (i) => <span className="block text-right text-xs text-muted-foreground tabular-nums">{formatCurrency(i.proposedValue)}</span> },
        { id: "repassado", header: "Repassado", sortable: true, sortValue: (i) => i.transferredValue, className: "w-[140px]", headerClassName: "w-[140px] text-right", cell: (i) => <span className="block text-right font-semibold tabular-nums">{formatCurrency(i.transferredValue)}</span> },
      ]}
      data={data}
      keyFn={(i, idx) => `${i.number}-${i.beneficiary}-${idx}`}
      searchable
      searchPlaceholder="Buscar por beneficiário..."
      searchFields={[(i) => i.beneficiary, (i) => i.number]}
      emptyMessage="Nenhuma emenda individual vinculada no período."
    />
  )
}

export function AssetsTable({ data }: { data: Asset[] }) {
  return (
    <DataTable
      columns={[
        { id: "tipo", header: "Tipo", sortable: true, sortValue: (i) => i.type, cell: (i) => <span className="font-medium">{i.type}</span> },
        { id: "descricao", header: "Descrição", cell: (i) => <p className="text-xs text-muted-foreground text-pretty">{i.description}</p> },
        { id: "valor", header: "Valor", sortable: true, sortValue: (i) => i.value, className: "w-[150px]", headerClassName: "w-[150px] text-right", cell: (i) => <span className="block text-right font-semibold tabular-nums">{formatCurrency(i.value)}</span> },
      ]}
      data={data}
      keyFn={(i, idx) => `${i.type}-${i.value}-${i.description}-${idx}`}
      searchable
      searchPlaceholder="Buscar por tipo ou descrição..."
      searchFields={[(i) => i.type, (i) => i.description]}
      emptyMessage="Nenhum bem disponível para esta candidatura."
    />
  )
}

export function CampaignDonorsTable({ data }: { data: CampaignDonor[] }) {
  return (
    <DataTable
      columns={[
        { id: "doador", header: "Doador", sortable: true, sortValue: (i) => i.name, cell: (i) => <span className="font-medium">{i.name}</span> },
        { id: "valor", header: "Valor", sortable: true, sortValue: (i) => i.value, className: "w-[180px]", headerClassName: "w-[180px] text-right", cell: (i) => <span className="block text-right font-semibold tabular-nums">{formatCurrency(i.value)}</span> },
      ]}
      data={data}
      keyFn={(i, idx) => `${i.name}-${i.value}-${idx}`}
      searchable
      searchPlaceholder="Buscar por doador..."
      searchFields={[(i) => i.name]}
      emptyMessage="Nenhum doador disponível para esta candidatura."
    />
  )
}

export function CampaignSuppliersTable({ data }: { data: CampaignSupplier[] }) {
  return (
    <DataTable
      columns={[
        { id: "fornecedor", header: "Fornecedor", sortable: true, sortValue: (i) => i.name, cell: (i) => <span className="font-medium">{i.name}</span> },
        { id: "valor", header: "Valor", sortable: true, sortValue: (i) => i.value, className: "w-[180px]", headerClassName: "w-[180px] text-right", cell: (i) => <span className="block text-right font-semibold tabular-nums">{formatCurrency(i.value)}</span> },
      ]}
      data={data}
      keyFn={(i, idx) => `${i.name}-${i.value}-${idx}`}
      searchable
      searchPlaceholder="Buscar por fornecedor..."
      searchFields={[(i) => i.name]}
      emptyMessage="Nenhum fornecedor disponível para esta candidatura."
    />
  )
}
