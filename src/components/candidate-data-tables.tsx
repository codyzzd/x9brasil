"use client"

import { useState, useMemo } from "react"
import { ExternalLink, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/ranking"
import { DataTable, type FilterDef } from "@/components/data-table"

/* ───── helpers ───── */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`))
}

function formatDecimal(value: number | null | undefined) {
  return value === null || value === undefined
    ? "Dados indisponíveis"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)
}

function publicVoteClassificationLabel(value: string) {
  if (value === "positive_public_interest") return "interesse público"
  if (value === "low_relevance") return "baixa relevância"
  if (value === "negative_public_interest") return "negativa"
  if (value === "harmful_or_self_serving") return "auto-benefício"
  return "neutra"
}

function severityLabel(value: string) {
  if (value === "critical") return "crítica"
  if (value === "high") return "alta"
  if (value === "medium") return "média"
  return "baixa"
}

function severityPoints(value: string) {
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
type PublicVote = { voteId: string; date: string; description: string; summary: string; url: string; candidateVote: string; classification: string; severity: string; scoreDelta: number; confidence: number; reason: string; source: string; reviewedManually: boolean }
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

  const aligned =
    vote.classification === "positive_public_interest" || vote.classification === "neutral"
      ? vote.candidateVote === "yes"
      : vote.candidateVote === "no"
  const points = severityPoints(vote.severity)
  const methodLabel =
    vote.source === "reviewed" ? "Revisão manual" : "Regra automática"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-base">
            Votação {vote.voteId}
          </SheetTitle>
          <SheetDescription>
            Detalhes completos da votação e do impacto no score
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
              {vote.reason}
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
                <li>Pontos base da severidade ({severityLabel(vote.severity)}): {points}</li>
                {vote.candidateVote === "absent" && (
                  <li>Ausência em votação de severidade {severityLabel(vote.severity)}</li>
                )}
                {vote.candidateVote !== "absent" && vote.candidateVote !== "abstain" && (
                  <li>Voto {aligned ? "alinhado" : "contrário"} ao interesse público</li>
                )}
                <li>Confiança da classificação: {formatDecimal(vote.confidence * 100)}%</li>
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

const ITEMS_PER_PAGE = 15

type SortKey = "date" | "classification" | "impact"
type SortDir = "asc" | "desc"

function VoteVoteList({
  data,
  onOpenSheet,
  classificationFilter,
}: {
  data: PublicVote[]
  onOpenSheet: (vote: PublicVote) => void
  classificationFilter: FilterDef<PublicVote>
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "impact", dir: "desc" })
  const [activeClassification, setActiveClassification] = useState("")

  const filtered = useMemo(() => {
    let result = data
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (v) =>
          v.description.toLowerCase().includes(q) ||
          (v.summary ?? "").toLowerCase().includes(q),
      )
    }
    if (activeClassification) {
      result = result.filter((v) => v.classification === activeClassification)
    }
    return result
  }, [data, search, activeClassification])

  const sorted = useMemo(() => {
    const items = [...filtered]
    items.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1
      if (sort.key === "date") return dir * a.date.localeCompare(b.date)
      if (sort.key === "classification") return dir * a.classification.localeCompare(b.classification)
      return dir * (Math.abs(a.scoreDelta) - Math.abs(b.scoreDelta))
    })
    return items
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginated = sorted.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  )

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    )
  }

  if (!data.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma votação classificada entrou no cálculo deste período.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-8"
          />
        </div>
        <Select value={activeClassification} onValueChange={(v) => { setActiveClassification(v === "" ? "" : v ?? ""); setPage(0) }}>
          <SelectTrigger className="w-auto min-w-36">
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {classificationFilter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground border-b pb-2">
        <span className="flex-[3]">Descrição</span>
        <span className="flex-[2] flex items-center gap-1">
          <button type="button" onClick={() => toggleSort("classification")} className={cn("inline-flex items-center gap-1 text-xs font-medium cursor-pointer", sort.key === "classification" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            Classificação
            {sort.key === "classification" ? (
              sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
            ) : (
              <ArrowUpDown className="size-3 opacity-40" />
            )}
          </button>
        </span>
        <span className="w-[70px] text-right flex items-center justify-end gap-1">
          <button type="button" onClick={() => toggleSort("impact")} className={cn("inline-flex items-center gap-1 text-xs font-medium cursor-pointer", sort.key === "impact" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            Impacto
            {sort.key === "impact" ? (
              sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
            ) : (
              <ArrowUpDown className="size-3 opacity-40" />
            )}
          </button>
        </span>
      </div>

      <div className="divide-y rounded-lg border">
        {paginated.map((vote, idx) => (
          <button
            key={`${vote.voteId}-${vote.candidateVote}-${idx}`}
            type="button"
            onClick={() => onOpenSheet(vote)}
            className="flex w-full items-start gap-4 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <div className="flex-[3] min-w-0">
              <p className="text-sm font-medium leading-snug line-clamp-2">{vote.description}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <span>{formatDate(vote.date)}</span>
                <span>·</span>
                <span>Voto: {candidateVoteLabel(vote.candidateVote)}</span>
                <span>·</span>
                <span>Confiança {formatDecimal(vote.confidence * 100)}%</span>
              </div>
            </div>
            <div className="flex-[2] min-w-0">
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className={cn("text-[11px]", CLASSIFICATION_STYLES[vote.classification] || "")}>{publicVoteClassificationLabel(vote.classification)}</Badge>
                <Badge variant="outline" className={cn("text-[11px]", SEVERITY_STYLES[vote.severity] || "")}>{severityLabel(vote.severity)}</Badge>
              </div>
            </div>
            <div className="w-[70px] shrink-0 text-right">
              <span className={cn("font-semibold tabular-nums text-sm", vote.scoreDelta < 0 ? "text-red-700 dark:text-red-400" : vote.scoreDelta > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                {vote.scoreDelta > 0 ? "+" : ""}{formatDecimal(vote.scoreDelta)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sorted.length} registro{sorted.length !== 1 ? "s" : ""}
          {search || activeClassification ? " encontrado" + (sorted.length !== 1 ? "s" : "") : ""}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), currentPage === 0 && "pointer-events-none opacity-50")}
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {currentPage + 1} de {totalPages}
            </span>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), currentPage >= totalPages - 1 && "pointer-events-none opacity-50")}
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Próximo
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function PublicVotesTable({ data }: { data: PublicVote[] }) {
  const [selected, setSelected] = useState<PublicVote | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function openSheet(vote: PublicVote) {
    setSelected(vote)
    setSheetOpen(true)
  }

  const classificationFilter: FilterDef<PublicVote> = {
    id: "classification",
    label: "Classificação",
    options: [
      { value: "positive_public_interest", label: "Interesse público" },
      { value: "low_relevance", label: "Baixa relevância" },
      { value: "negative_public_interest", label: "Negativa" },
      { value: "harmful_or_self_serving", label: "Auto-benefício" },
      { value: "neutral", label: "Neutra" },
    ],
    getValue: (vote) => vote.classification,
  }

  return (
    <>
      <VoteVoteList data={data} onOpenSheet={openSheet} classificationFilter={classificationFilter} />
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
