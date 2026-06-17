"use client"

import { useMemo, useState } from "react"
import {
  ArrowRightLeft,
  ExternalLink,
  FileEdit,
  FileSearch,
  FileText,
  Heart,
  Info,
  Pen,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { labelTone } from "@/lib/label-tone"
import { DataTable, type Column, type FilterDef } from "@/components/data-table"

type Proposal = {
  id: string
  type: string
  number: string
  year: string
  date: string
  summary: string
  status: string
  url: string
  participationRole: string
  participationLabel: string
  proposalNature: string
  proposalNatureLabel: string
  publicValue?: {
    category: string
    categoryLabel: string
    categoryWeight: number
    confidence: string
    justification: string
    source: string
    stage: string
    stageMultiplier: number
    points: number
    methodologyVersion: string
    roleWeight: number
    natureWeight: number
    progressBonus: number
    scoreExplanation: string
  } | null
}

const ROLE_STYLES: Record<string, string> = {
  AUTHOR: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400",
  COAUTHOR: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-400",
  REQUESTER: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-400",
  FISCALIZATION: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400",
  SIGNATORY: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
}

const NATURE_STYLES: Record<string, string> = {
  SUBSTANTIVE: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-400",
  FISCALIZATION: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400",
  PROCEDURAL: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-400",
  SYMBOLIC: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
}

const STAGE_LABELS: Record<string, string> = {
  converted: "Transformada em norma",
  advanced: "Com tramitação avançada",
  presented: "Apresentada",
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  AUTHOR: <FileEdit className="size-3" />,
  COAUTHOR: <Users className="size-3" />,
  REQUESTER: <FileSearch className="size-3" />,
  FISCALIZATION: <Search className="size-3" />,
  SIGNATORY: <Pen className="size-3" />,
}

const NATURE_ICONS: Record<string, React.ReactNode> = {
  SUBSTANTIVE: <FileText className="size-3" />,
  FISCALIZATION: <Shield className="size-3" />,
  PROCEDURAL: <ArrowRightLeft className="size-3" />,
  SYMBOLIC: <Heart className="size-3" />,
}

function stageLabel(stage: string) {
  return STAGE_LABELS[stage] || stage
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`))
}

function labelStyle(label: string) {
  const tone = labelTone(label)
  if (tone === "positive") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
  }
  if (tone === "negative") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
}

function pickFilter(
  proposals: Proposal[],
  id: string,
  label: string,
  getValue: (p: Proposal) => string,
): FilterDef<Proposal> {
  const values = new Set<string>()
  for (const p of proposals) {
    const v = getValue(p)
    if (v) values.add(v)
  }
  const options = Array.from(values).sort().map((v) => ({ value: v, label: v }))
  return { id, label, options, getValue }
}

function ProposalSheet({
  proposal,
  open,
  onOpenChange,
}: {
  proposal: Proposal | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!proposal) return null

  const pv = proposal.publicValue

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-base">
            {proposal.type} {proposal.number}/{proposal.year}
          </SheetTitle>
          <SheetDescription>
            Detalhes completos da proposição
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 p-4 pt-5">
          {/* Ementa completa */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Ementa
            </h4>
            <p className="text-sm leading-relaxed text-foreground">
              {proposal.summary}
            </p>
          </section>

          {/* Metadados */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Tipo
              </h4>
              <p className="text-sm">{proposal.type}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Papel
              </h4>
              <Badge
                variant="outline"
                className={cn("inline-flex items-center gap-1 text-[11px]", ROLE_STYLES[proposal.participationRole] || "")}
              >
                {ROLE_ICONS[proposal.participationRole]}
                {proposal.participationLabel}
              </Badge>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Status
              </h4>
              <p className="text-sm">{proposal.status}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Data
              </h4>
              <p className="text-sm">{formatDate(proposal.date)}</p>
            </div>
          </div>

          {/* Natureza */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Natureza da proposição
            </h4>
            <Badge
              variant="outline"
              className={cn("inline-flex items-center gap-1 text-[11px]", NATURE_STYLES[proposal.proposalNature] || "")}
            >
              {NATURE_ICONS[proposal.proposalNature]}
              {proposal.proposalNatureLabel}
            </Badge>
          </div>

          {/* Classificação e pontuação */}
          {pv && (
            <>
              <section>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Classificação
                </h4>
                <Badge
                  variant="outline"
                  className={cn("inline-flex items-center gap-1 text-[11px]", labelStyle(pv.category))}
                >
                  <Sparkles className="size-3" />
                  {pv.categoryLabel}
                </Badge>
                {pv.justification && (
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {pv.justification}
                  </p>
                )}
              </section>

              <section>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Pontuação
                </h4>
                <div className="space-y-1">
                  <p className="text-lg font-semibold tabular-nums">
                    {pv.points.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    pts
                  </p>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    <li>Peso do tema: ×{pv.categoryWeight}</li>
                    <li>Papel: ×{pv.roleWeight}</li>
                    <li>Natureza: ×{pv.natureWeight}</li>
                    {pv.progressBonus > 0 && (
                      <li>Bônus de avanço: +{pv.progressBonus}</li>
                    )}
                    <li>Estágio: {stageLabel(pv.stage)} (×{pv.stageMultiplier})</li>
                  </ul>
                </div>
              </section>
            </>
          )}

          {/* Link oficial */}
          <div className="pt-2">
            <a
              href={proposal.url}
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

export function ProposalsTable({ proposals }: { proposals: Proposal[] }) {
  const [selected, setSelected] = useState<Proposal | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function openSheet(p: Proposal) {
    setSelected(p)
    setSheetOpen(true)
  }

  const filters = useMemo(() => {
    const result: FilterDef<Proposal>[] = []
    const add = (id: string, label: string, getValue: (p: Proposal) => string) => {
      const f = pickFilter(proposals, id, label, getValue)
      if (f.options.length > 0) result.push(f)
    }
    add("papel", "Papel", (p) => p.participationLabel)
    add("tipo", "Tipo", (p) => p.proposalNatureLabel)
    add("status", "Status", (p) => p.status)
    add("classification", "Classificação", (p) => p.publicValue?.categoryLabel ?? "")
    return result
  }, [proposals])

  const columns: Column<Proposal>[] = [
    {
      id: "proposicao",
      header: "Proposição",
      sortable: true,
      sortValue: (p) => `${p.type} ${p.number}${p.year} ${p.summary}`,
      className: "min-w-[220px] flex-1",
      cell: (p) => (
        <div>
          <button
            type="button"
            onClick={() => openSheet(p)}
            className="inline-flex items-center gap-1 font-medium text-sm text-left hover:underline underline-offset-2 cursor-pointer"
          >
            {p.type} {p.number}/{p.year}
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
          </button>
          <p className="mt-0.5 line-clamp-3 text-pretty text-xs text-muted-foreground leading-relaxed">
            {p.summary}
          </p>
          <button
            type="button"
            onClick={() => openSheet(p)}
            className="mt-0.5 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          >
            Ver ementa completa
          </button>
        </div>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      sortable: true,
      sortValue: (p) => p.proposalNatureLabel,
      className: "w-[110px]",
      headerClassName: "w-[110px]",
      cell: (p) => (
        <Badge
          variant="outline"
          className={cn("inline-flex items-center gap-1 text-[10px]", NATURE_STYLES[p.proposalNature] || "")}
        >
          {NATURE_ICONS[p.proposalNature]}
          {p.proposalNatureLabel}
        </Badge>
      ),
    },
    {
      id: "papel",
      header: "Papel",
      sortable: true,
      sortValue: (p) => p.participationLabel,
      className: "w-[100px]",
      headerClassName: "w-[100px]",
      cell: (p) => (
        <Badge
          variant="outline"
          className={cn("inline-flex items-center gap-1 text-[10px]", ROLE_STYLES[p.participationRole] || "")}
        >
          {ROLE_ICONS[p.participationRole]}
          {p.participationLabel}
        </Badge>
      ),
    },
    {
      id: "classificacao",
      header: "Classificação",
      sortable: true,
      sortValue: (p) => p.publicValue?.points ?? 0,
      className: "w-[160px]",
      headerClassName: "w-[160px]",
      cell: (p) =>
        p.publicValue ? (
          <div className="space-y-1">
            <p className="text-xs tabular-nums font-semibold">
              {p.publicValue.points.toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}{" "}
              pts
            </p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {p.publicValue.scoreExplanation}
            </p>
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className={cn("inline-flex items-center gap-1 text-[10px]", labelStyle(p.publicValue.category))}
              >
                <Sparkles className="size-3" />
                {p.publicValue.categoryLabel}
              </Badge>
              <Tooltip>
                <TooltipTrigger className="inline-flex items-center justify-center size-4 rounded-full hover:bg-muted transition-colors">
                  <Info className="size-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
                  <p>Esta pontuação considera o papel do parlamentar, o tipo da proposição e o avanço da tramitação.</p>
                  <p className="mt-1 text-muted-foreground">
                    {p.publicValue.scoreExplanation} · {stageLabel(p.publicValue.stage)} (×{p.publicValue.stageMultiplier})
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (p) => p.status,
      className: "w-[160px]",
      headerClassName: "w-[160px]",
      cell: (p) => <span className="line-clamp-1 text-xs">{p.status}</span>,
    },
    {
      id: "data",
      header: "Data",
      sortable: true,
      sortValue: (p) => p.date,
      className: "w-[100px]",
      headerClassName: "w-[100px]",
      cell: (p) => (
        <span className="text-xs text-muted-foreground">{formatDate(p.date)}</span>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={proposals}
        keyFn={(p, idx) => `${p.id}-${idx}`}
        searchable
        searchPlaceholder="Buscar por ementa, tipo, número ou ano..."
        searchFields={[
          (p) => p.summary,
          (p) => p.type,
          (p) => p.number,
          (p) => p.year,
          (p) => p.status,
        ]}
        filters={filters}
        emptyMessage="Nenhuma proposição encontrada no período."
      />
      <ProposalSheet
        proposal={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
