"use client"

import { useMemo, useState } from "react"
import {
  ArrowRightLeft,
  BadgeCheck,
  Brain,
  ExternalLink,
  FileEdit,
  FileSearch,
  FileText,
  Heart,
  Info,
  ListChecks,
  Pen,
  Search,
  Shield,
  Sparkles,
  Users,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
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
    analysisLevel: 1 | 2 | 3
    stage: string
    stageMultiplier: number
    points: number
    methodologyVersion: string
    roleWeight: number
    natureWeight: number
    progressBonus: number
    scoreExplanation: string
    analysisMethodVersion?: string
    legislativeType?: string
    decisionNature?: string
    decisionScope?: string
    declaredBenefit?: string
    hiddenCost?: string
    netPublicEffect?: string
    hasTradeoff?: boolean
    summaryMatchesText?: string
    riskFlags?: string[]
    criticalArticles?: Array<{ article: string; issue: string }>
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

function analysisMethod(source: string, analysisLevel: 1 | 2 | 3 | undefined) {
  if (source === "reviewed") {
    return { label: "Revisado manualmente", Icon: BadgeCheck }
  }
  const level = analysisLevel ?? (source === "rule" ? 1 : source === "llm" ? 2 : undefined)
  if (level === 1) return { label: "Nível 1 · regra automática", Icon: ListChecks }
  if (level === 2) return { label: "Nível 2 · IA com resumo", Icon: Sparkles }
  if (level === 3) return { label: "Nível 3 · IA com inteiro teor", Icon: Brain }
  return { label: "Não analisada", Icon: FileSearch }
}

function justificationTitle(source: string, analysisLevel: 1 | 2 | 3 | undefined) {
  if (source === "reviewed") return "Justificativa da revisão"
  const level = analysisLevel ?? (source === "rule" ? 1 : source === "llm" ? 2 : undefined)
  return level && level > 1 ? "Justificativa da IA" : "Justificativa da regra"
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

function netPublicEffectLabel(value: string) {
  if (value === "positive") return "positivo"
  if (value === "negative") return "negativo"
  if (value === "mixed") return "misto"
  if (value === "unclear") return "incerto"
  return "-"
}

function riskFlagLabel(value: string) {
  return value.replaceAll("_", " ")
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
  const method = pv ? analysisMethod(pv.source, pv.analysisLevel) : null
  const MethodIcon = method?.Icon

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-4xl data-[side=right]:xl:max-w-5xl"
      >
        <SheetHeader className="sticky top-0 z-10 flex-row items-start justify-between gap-4 border-b bg-popover pb-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <SheetTitle className="text-balance text-base">
              {proposal.type} {proposal.number}/{proposal.year}
            </SheetTitle>
            <SheetDescription>
              Detalhes completos da proposição
            </SheetDescription>
          </div>
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="-mr-3 -mt-2 size-10 shrink-0"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Fechar</span>
          </SheetClose>
        </SheetHeader>

        <div className="grid flex-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8 lg:px-8">
          <div className="space-y-6">
            <section>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dados oficiais
              </h4>
              <p className="text-pretty text-sm leading-relaxed text-foreground">
                {proposal.summary}
              </p>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tipo
                  </dt>
                  <dd className="text-sm">{proposal.type}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Data
                  </dt>
                  <dd className="text-sm">{formatDate(proposal.date)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </dt>
                  <dd className="text-sm">{proposal.status}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Papel
                  </dt>
                  <dd>
                    <Badge
                      variant="outline"
                      className={cn("inline-flex items-center gap-1 text-[11px]", ROLE_STYLES[proposal.participationRole] || "")}
                    >
                      {ROLE_ICONS[proposal.participationRole]}
                      {proposal.participationLabel}
                    </Badge>
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <Badge
                  variant="outline"
                  className={cn("inline-flex items-center gap-1 text-[11px]", NATURE_STYLES[proposal.proposalNature] || "")}
                >
                  {NATURE_ICONS[proposal.proposalNature]}
                  {proposal.proposalNatureLabel}
                </Badge>
              </div>
            </section>

            <section className="border-t pt-5">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saiba por quê
              </h4>
              {pv ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">
                    {justificationTitle(pv.source, pv.analysisLevel)}
                  </p>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {pv.justification || "Esta proposição ainda não tem justificativa detalhada registrada."}
                  </p>
                </>
              ) : (
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  Esta proposição ainda não foi classificada pela metodologia de valor público.
                </p>
              )}
            </section>

            {pv && (pv.analysisMethodVersion || pv.netPublicEffect || pv.declaredBenefit || pv.hiddenCost) && (
              <section className="border-t pt-5">
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Auditoria N3
                </h4>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</dt>
                    <dd>{pv.legislativeType || proposal.type || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efeito líquido</dt>
                    <dd>{netPublicEffectLabel(pv.netPublicEffect || "")}</dd>
                  </div>
                </dl>
                {(pv.declaredBenefit || pv.hiddenCost) && (
                  <div className="mt-3 space-y-2 text-pretty text-sm text-muted-foreground">
                    {pv.declaredBenefit && <p><span className="font-medium text-foreground">Benefício declarado:</span> {pv.declaredBenefit}</p>}
                    {pv.hiddenCost && <p><span className="font-medium text-foreground">Custo escondido:</span> {pv.hiddenCost}</p>}
                  </div>
                )}
                {pv.riskFlags && pv.riskFlags.filter((flag) => flag !== "none").length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pv.riskFlags.filter((flag) => flag !== "none").map((flag) => (
                      <Badge key={flag} variant="outline" className="text-[11px]">
                        {riskFlagLabel(flag)}
                      </Badge>
                    ))}
                  </div>
                )}
                {pv.criticalArticles && pv.criticalArticles.length > 0 && (
                  <ul className="mt-3 space-y-1 text-pretty text-xs text-muted-foreground">
                    {pv.criticalArticles.map((item, index) => (
                      <li key={`${item.article}-${index}`}>
                        <span className="font-medium text-foreground">{item.article}:</span> {item.issue}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-6 border-t pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <section>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Classificação
              </h4>
              {pv ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn("inline-flex items-center gap-1 text-[11px]", labelStyle(pv.category))}
                    >
                      <Sparkles className="size-3" />
                      {pv.categoryLabel}
                    </Badge>
                    {method && MethodIcon && (
                      <Badge variant="outline" className="inline-flex items-center gap-1 text-[11px]">
                        <MethodIcon className="size-3" />
                        {method.label}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confiança: {pv.confidence === "high" ? "alta" : pv.confidence === "medium" ? "média" : "baixa"}
                  </p>
                </>
              ) : (
                <Badge variant="outline" className="inline-flex items-center gap-1 text-[11px]">
                  <FileSearch className="size-3" />
                  Não analisada
                </Badge>
              )}
            </section>

            <section className="border-t pt-5">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Impacto
              </h4>
              {pv ? (
                <div className="space-y-1">
                  <p className={cn(
                    "text-lg font-semibold tabular-nums",
                    pv.points > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                  )}>
                    {pv.points > 0 ? "+" : ""}
                    {pv.points.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    pts
                  </p>
                  <ul className="space-y-0.5 text-pretty text-xs text-muted-foreground">
                    <li>Peso do tema: ×{pv.categoryWeight}</li>
                    <li>Papel: ×{pv.roleWeight}</li>
                    <li>Natureza: ×{pv.natureWeight}</li>
                    {pv.progressBonus > 0 && (
                      <li>Bônus de avanço: +{pv.progressBonus}</li>
                    )}
                    <li>Estágio: {stageLabel(pv.stage)} (×{pv.stageMultiplier})</li>
                    {method && <li>Método: {method.label}</li>}
                  </ul>
                </div>
              ) : (
                <>
                  <p className="text-lg font-semibold text-muted-foreground tabular-nums">0 pts</p>
                  <p className="text-pretty text-xs text-muted-foreground">
                    Itens não analisados não entram na produção.
                  </p>
                </>
              )}
            </section>

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
          </aside>
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
      className: "w-[34%] whitespace-normal",
      headerClassName: "w-[34%]",
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
            Ver análise
          </button>
        </div>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      sortable: true,
      sortValue: (p) => p.proposalNatureLabel,
      className: "w-[86px]",
      headerClassName: "w-[86px]",
      cell: (p) => (
        <Badge
          variant="outline"
          className={cn("inline-flex max-w-full items-center gap-1 text-[10px]", NATURE_STYLES[p.proposalNature] || "")}
        >
          {NATURE_ICONS[p.proposalNature]}
          <span className="min-w-0 truncate">{p.proposalNatureLabel}</span>
        </Badge>
      ),
    },
    {
      id: "papel",
      header: "Papel",
      sortable: true,
      sortValue: (p) => p.participationLabel,
      className: "w-[112px]",
      headerClassName: "w-[112px]",
      cell: (p) => (
        <Badge
          variant="outline"
          className={cn("inline-flex max-w-full items-center gap-1 text-[10px]", ROLE_STYLES[p.participationRole] || "")}
        >
          {ROLE_ICONS[p.participationRole]}
          <span className="min-w-0 truncate">{p.participationLabel}</span>
        </Badge>
      ),
    },
    {
      id: "classificacao",
      header: "Classificação",
      sortable: true,
      sortValue: (p) => p.publicValue?.points ?? 0,
      className: "w-[150px] whitespace-normal",
      headerClassName: "w-[150px]",
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
                className={cn("inline-flex max-w-[126px] items-center gap-1 text-[10px]", labelStyle(p.publicValue.category))}
              >
                <Sparkles className="size-3" />
                <span className="min-w-0 truncate">{p.publicValue.categoryLabel}</span>
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
      className: "w-[120px] whitespace-normal",
      headerClassName: "w-[120px]",
      cell: (p) => <span className="block truncate text-xs">{p.status}</span>,
    },
    {
      id: "data",
      header: "Data",
      sortable: true,
      sortValue: (p) => p.date,
      className: "w-[82px]",
      headerClassName: "w-[82px]",
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
        tableClassName="table-fixed"
      />
      <ProposalSheet
        proposal={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
