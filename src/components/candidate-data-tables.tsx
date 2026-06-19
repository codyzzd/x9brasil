"use client"

import { useState } from "react"
import {
  BadgeCheck,
  Brain,
  ExternalLink,
  FileSearch,
  ListChecks,
  Sparkles,
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
  if (value === "negative_public_interest") return "contra interesse público"
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

function netPublicEffectLabel(value: string) {
  if (value === "positive") return "positivo"
  if (value === "negative") return "negativo"
  if (value === "mixed") return "misto"
  if (value === "neutral") return "neutro"
  if (value === "unclear") return "incerto"
  if (value === "insufficient") return "insuficiente"
  return "-"
}

function scoreImpactLimitLabel(value: string) {
  if (value === "none") return "zerado"
  if (value === "low") return "baixo"
  if (value === "medium") return "médio"
  if (value === "high") return "alto"
  if (value === "critical") return "crítico"
  return "-"
}

function riskFlagLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace("benefit offset by hidden cost", "benefício compensado por custo escondido")
    .replace("hidden revocation", "revogação escondida")
    .replace("scope mismatch", "escopo divergente")
    .replace("unrelated amendment", "emenda sem relação clara")
    .replace("privilege or benefit", "privilégio ou benefício")
    .replace("fiscal impact", "impacto fiscal")
    .replace("transparency reduction", "redução de transparência")
    .replace("oversight reduction", "redução de fiscalização")
    .replace("constitutional risk", "risco constitucional")
    .replace("increased workload", "aumento de carga")
    .replace("reduced rights", "redução de direitos")
    .replace("procedural only", "apenas procedimental")
    .replace("vote object unclear", "objeto do voto incerto")
    .replace("text does not match vote object", "texto não corresponde ao objeto")
    .replace("insufficient text", "texto insuficiente")
    .replace("insufficient vote object text", "texto do objeto insuficiente")
}

function analysisStatusLabel(value: string) {
  if (value === "validated") return "validado com score"
  if (value === "neutral_validated") return "neutro validado"
  if (value === "pending_strong_review") return "pendente de revisão forte"
  if (value === "insufficient_data") return "dados insuficientes"
  if (value === "mixed_requires_review") return "misto, exige revisão"
  if (value === "procedural_low_confidence") return "procedimental com baixa confiança"
  if (value === "not_eligible") return "fora do escopo"
  if (value === "failed_parsing") return "falha de leitura"
  return value || "-"
}

function riskLevelLabel(value: string) {
  if (value === "critical") return "risco crítico"
  if (value === "high") return "risco alto"
  if (value === "medium") return "risco médio"
  if (value === "low") return "risco baixo"
  return value || "-"
}

function candidateVoteLabel(value: string) {
  if (value === "yes") return "sim"
  if (value === "no") return "não"
  if (value === "absent") return "ausente"
  return "abstenção"
}

function inferredAnalysisLevel(source: string, analysisLevel: 1 | 2 | 3 | null | undefined) {
  if (analysisLevel === 1 || analysisLevel === 2 || analysisLevel === 3) return analysisLevel
  if (source === "rule") return 1
  if (source === "llm") return 2
  return null
}

function analysisMethod(source: string, analysisLevel: 1 | 2 | 3 | null | undefined, reviewedManually: boolean) {
  if (reviewedManually || source === "reviewed") {
    return { label: "Revisado manualmente", Icon: BadgeCheck }
  }
  const level = inferredAnalysisLevel(source, analysisLevel)
  if (level === 1) return { label: "Nível 1 · regra automática", Icon: ListChecks }
  if (level === 2) return { label: "Nível 2 · IA com resumo", Icon: Sparkles }
  if (level === 3) return { label: "Nível 3 · auditoria segura", Icon: Brain }
  return { label: "Não analisado", Icon: FileSearch }
}

function justificationTitle(source: string, analysisLevel: 1 | 2 | 3 | null | undefined, reviewedManually: boolean) {
  if (reviewedManually || source === "reviewed") return "Justificativa da revisão"
  const level = inferredAnalysisLevel(source, analysisLevel)
  return level && level > 1 ? "Justificativa da IA" : "Justificativa da regra"
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
    label: "Contra interesse público",
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

const VOTE_POSITIONING_SEGMENTS: {
  key: "aligned" | "opposed" | "absence" | "unanalyzed"
  label: string
  barClass: string
  dotClass: string
}[] = [
  {
    key: "aligned",
    label: "Alinhado",
    barClass: "bg-emerald-500 dark:bg-emerald-400",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
  {
    key: "opposed",
    label: "Contrário",
    barClass: "bg-red-500 dark:bg-red-400",
    dotClass: "bg-red-500 dark:bg-red-400",
  },
  {
    key: "absence",
    label: "Ausência/abstenção",
    barClass: "bg-gray-400 dark:bg-gray-500",
    dotClass: "bg-gray-400 dark:bg-gray-500",
  },
  {
    key: "unanalyzed",
    label: "Não analisado",
    barClass: "bg-slate-300 dark:bg-slate-600",
    dotClass: "bg-slate-300 dark:bg-slate-600",
  },
]

/* ───── types ───── */

type ExpenseCategory = { name: string; total: number; documents: number }
type Supplier = { name: string; taxId: string | null; total: number; documents: number }
type LargestExpense = { category: string; supplier: string; date: string; value: number; documentUrl: string | null }
type PublicVote = { voteId: string; date: string; description: string; summary: string; url: string; candidateVote: string; classification: string; severity: string; scoreDelta: number; scorePoints?: number | null; affectsScore?: boolean; analysisStatus?: string; riskLevel?: string; needsStrongReview?: boolean; reviewReason?: string; coverageCategory?: string; confidence: number | null; reason: string; source: string; analysisLevel: 1 | 2 | 3 | null; reviewedManually: boolean; analysisMethodVersion?: string; legislativeType?: string; decisionNature?: string; decisionScope?: string; voteObjectType?: string; voteObjectSubtype?: string; voteObjectDescription?: string; yesMeans?: string; noMeans?: string; voteObjectTextFound?: boolean; primaryTextUsed?: string; usedRelatedBillAsMainEvidence?: boolean; analyzedTextMatchesVoteObject?: string; scoreImpactLimit?: string; recommendedScoreImpact?: number | null; scoreSafetyReason?: string; modelRecommendation?: string; modelUsed?: string; modelRole?: string; isProceduralVote?: boolean; declaredBenefit?: string; hiddenCost?: string; netPublicEffect?: string; hasTradeoff?: boolean; summaryMatchesText?: string; riskFlags?: string[]; criticalArticles?: Array<{ article: string; issue: string; appearsInVoteObjectText?: boolean }> }
type Amendment = { number: string; year: string; type: string; beneficiary: string; proposedValue: number; transferredValue: number }
type Asset = { type: string; description: string; value: number }
type CampaignDonor = { name: string; value: number }
type CampaignSupplier = { name: string; value: number }

/* ───── tables ───── */

function votePositioningKey(vote: PublicVote): "aligned" | "opposed" | "absence" | "unanalyzed" {
  if (vote.classification === "unanalyzed") return "unanalyzed"
  if (vote.candidateVote === "absent" || vote.candidateVote === "abstain") return "absence"

  const positiveOrNeutral =
    vote.classification === "positive_public_interest" ||
    vote.classification === "neutral"
  const negativeOrHarmful =
    vote.classification === "negative_public_interest" ||
    vote.classification === "harmful_or_self_serving"

  if (
    (positiveOrNeutral && vote.candidateVote === "yes") ||
    (negativeOrHarmful && vote.candidateVote === "no")
  ) {
    return "aligned"
  }

  return "opposed"
}

export function VotePositioningBar({ data }: { data: PublicVote[] }) {
  const segments = VOTE_POSITIONING_SEGMENTS.map((s) => ({
    ...s,
    count: data.filter((vote) => votePositioningKey(vote) === s.key).length,
  }))
  const total = segments.reduce((sum, s) => sum + s.count, 0)

  if (total === 0) return null

  return (
    <div className="space-y-4 sm:col-span-2 lg:col-span-4">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s) => {
          const pct = (s.count / total) * 100
          if (pct < 0.5) return null
          return (
            <div
              key={s.key}
              className={cn(s.barClass, "transition-[width] duration-500")}
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
  const method = analysisMethod(vote.source, vote.analysisLevel, vote.reviewedManually)
  const MethodIcon = method.Icon
  const reasonTitle = justificationTitle(vote.source, vote.analysisLevel, vote.reviewedManually)
  const pendingSafeScore = analyzed && vote.scorePoints === null && vote.affectsScore === false

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
              Votação {vote.voteId}
            </SheetTitle>
            <SheetDescription>
              {analyzed
                ? "Detalhes completos da votação e do impacto no score"
                : "Esta votação ainda não entrou no cálculo do score"}
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
                {vote.description}
              </p>
              {vote.summary && (
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  {vote.summary}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Data
                  </dt>
                  <dd className="text-sm">{formatDate(vote.date)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Voto do parlamentar
                  </dt>
                  <dd className="text-sm font-medium">{candidateVoteLabel(vote.candidateVote)}</dd>
                </div>
              </dl>
            </section>

            <section className="border-t pt-5">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saiba por quê
              </h4>
              <p className="text-xs font-medium text-muted-foreground">{reasonTitle}</p>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                {vote.reason || "Esta votação ainda não foi classificada pela metodologia de valor público."}
              </p>
            </section>

            {analyzed && (vote.analysisMethodVersion || vote.netPublicEffect || vote.voteObjectType) && (
              <section className="border-t pt-5">
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Auditoria N3
                </h4>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</dt>
                    <dd>{analysisStatusLabel(vote.analysisStatus || "")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risco</dt>
                    <dd>{riskLevelLabel(vote.riskLevel || "")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objeto</dt>
                    <dd>{vote.voteObjectDescription || vote.voteObjectType || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</dt>
                    <dd>{[vote.legislativeType, vote.voteObjectSubtype].filter(Boolean).join(" · ") || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efeito líquido</dt>
                    <dd>{netPublicEffectLabel(vote.netPublicEffect || "")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Limite</dt>
                    <dd>{scoreImpactLimitLabel(vote.scoreImpactLimit || "")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Texto específico</dt>
                    <dd>{vote.voteObjectTextFound ? "Encontrado" : "Não encontrado"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidência usada</dt>
                    <dd>{vote.primaryTextUsed || "-"}</dd>
                  </div>
                </dl>
                {(pendingSafeScore || vote.scoreSafetyReason || vote.usedRelatedBillAsMainEvidence || vote.netPublicEffect === "mixed" || vote.needsStrongReview) && (
                  <div className="mt-3 space-y-1 rounded-md border bg-muted/30 p-3 text-pretty text-xs text-muted-foreground">
                    {pendingSafeScore && (
                      <p>Sem impacto no score: a auditoria mini-first deixou este caso pendente em vez de arriscar uma pontuação enviesada.</p>
                    )}
                    {vote.scoreSafetyReason && <p>{vote.scoreSafetyReason}</p>}
                    {vote.needsStrongReview && vote.reviewReason && <p>{vote.reviewReason}</p>}
                    {vote.usedRelatedBillAsMainEvidence && (
                      <p>O sistema usou texto do projeto relacionado como contexto, não como prova suficiente do objeto específico votado.</p>
                    )}
                    {vote.netPublicEffect === "mixed" && (
                      <p>O efeito público é misto; por segurança, o impacto no score foi zerado ou limitado.</p>
                    )}
                    {vote.recommendedScoreImpact !== null && vote.recommendedScoreImpact !== undefined && (
                      <p>Impacto recomendado pela auditoria: {vote.recommendedScoreImpact > 0 ? "+" : ""}{formatDecimal(vote.recommendedScoreImpact)} pts.</p>
                    )}
                  </div>
                )}
                {(vote.yesMeans || vote.noMeans) && (
                  <div className="mt-3 space-y-2 text-pretty text-sm text-muted-foreground">
                    {vote.yesMeans && <p><span className="font-medium text-foreground">Sim:</span> {vote.yesMeans}</p>}
                    {vote.noMeans && <p><span className="font-medium text-foreground">Não:</span> {vote.noMeans}</p>}
                  </div>
                )}
                {(vote.declaredBenefit || vote.hiddenCost) && (
                  <div className="mt-3 space-y-2 text-pretty text-sm text-muted-foreground">
                    {vote.declaredBenefit && <p><span className="font-medium text-foreground">Benefício declarado:</span> {vote.declaredBenefit}</p>}
                    {vote.hiddenCost && <p><span className="font-medium text-foreground">Custo escondido:</span> {vote.hiddenCost}</p>}
                  </div>
                )}
                {vote.riskFlags && vote.riskFlags.filter((flag) => flag !== "none").length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {vote.riskFlags.filter((flag) => flag !== "none").map((flag) => (
                      <Badge key={flag} variant="outline" className="text-[11px]">
                        {riskFlagLabel(flag)}
                      </Badge>
                    ))}
                  </div>
                )}
                {vote.criticalArticles && vote.criticalArticles.length > 0 && (
                  <ul className="mt-3 space-y-1 text-pretty text-xs text-muted-foreground">
                    {vote.criticalArticles.map((item, index) => (
                      <li key={`${item.article}-${index}`}>
                        <span className="font-medium text-foreground">{item.article}:</span> {item.issue}
                        {item.appearsInVoteObjectText === false && " · fora do objeto votado"}
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
                <Badge variant="outline" className="inline-flex items-center gap-1 text-[11px]">
                  <MethodIcon className="size-3" />
                  {method.label}
                </Badge>
                {vote.analysisStatus && (
                  <Badge variant="outline" className="text-[11px]">
                    {analysisStatusLabel(vote.analysisStatus)}
                  </Badge>
                )}
              </div>
              {analyzed && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Confiança:{" "}
                  {vote.confidence === null ? "dados indisponíveis" : `${formatDecimal(vote.confidence * 100)}%`}
                </p>
              )}
            </section>

            <section className="border-t pt-5">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Impacto
              </h4>
              <div className="space-y-1">
                <p className={cn(
                  "text-lg font-semibold tabular-nums",
                  vote.scoreDelta < 0
                    ? "text-red-700 dark:text-red-400"
                    : vote.scoreDelta > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground",
                )}>
                  {vote.scorePoints === null ? "pendente" : `${vote.scoreDelta > 0 ? "+" : ""}${formatDecimal(vote.scoreDelta)} pts`}
                </p>
                <ul className="space-y-0.5 text-pretty text-xs text-muted-foreground">
                  {analyzed ? (
                    <>
                      {pendingSafeScore && (
                        <li>Não pontua porque precisa de texto específico, revisão forte ou evidência mais segura.</li>
                      )}
                      {vote.severity ? (
                        <li>Pontos base da severidade ({severityLabel(vote.severity)}): {points}</li>
                      ) : (
                        <li>Classificação detalhada indisponível neste registro.</li>
                      )}
                      {vote.scorePoints === 0 && vote.analysisStatus === "neutral_validated" && (
                        <li>Analisado como neutro: entra na cobertura, mas não altera o ranking.</li>
                      )}
                      {vote.candidateVote === "absent" && (
                        <li>Ausência em votação de severidade {severityLabel(vote.severity)}</li>
                      )}
                      {vote.scoreImpactLimit === "none" && (
                        <li>Impacto zerado porque não há base suficiente para concluir com segurança.</li>
                      )}
                      {vote.scoreImpactLimit === "low" && (
                        <li>Impacto limitado porque o objeto ou texto específico não permite conclusão forte.</li>
                      )}
                      {vote.voteObjectTextFound === false && (vote.analysisMethodVersion?.includes("v3") || vote.analysisMethodVersion?.includes("v4")) && (
                        <li>Texto específico do objeto votado não encontrado; N3 bloqueou impacto no score.</li>
                      )}
                      {vote.primaryTextUsed && vote.primaryTextUsed !== "vote_object" && (vote.analysisMethodVersion?.includes("v3") || vote.analysisMethodVersion?.includes("v4")) && (
                        <li>A evidência principal não foi o texto exato do objeto votado.</li>
                      )}
                      {vote.analyzedTextMatchesVoteObject === "false" && (
                        <li>Texto analisado não corresponde ao objeto exato da votação.</li>
                      )}
                      {vote.severity && vote.candidateVote !== "absent" && vote.candidateVote !== "abstain" && (
                        <li>Voto {aligned ? "alinhado" : "contrário"} ao interesse público</li>
                      )}
                    </>
                  ) : (
                    <li>Esta votação ainda não entrou no cálculo do score.</li>
                  )}
                  <li>Método: {method.label}</li>
                </ul>
              </div>
            </section>

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
          </aside>
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

export function PublicVotesTable({
  data,
  controls = true,
}: {
  data: PublicVote[]
  controls?: boolean
}) {
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
        { value: "negative_public_interest", label: "Contra interesse público" },
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
            Ver análise
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
      sortValue: (vote) => vote.scorePoints ?? 0,
      className: "w-[82px]",
      headerClassName: "w-[82px]",
      cell: (vote) => (
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            vote.scorePoints === null
              ? "text-muted-foreground"
              : vote.scoreDelta < 0
              ? "text-red-700 dark:text-red-400"
              : vote.scoreDelta > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-muted-foreground",
          )}
        >
          {vote.scorePoints === null ? "pendente" : `${vote.scoreDelta > 0 ? "+" : ""}${formatDecimal(vote.scoreDelta)}`}
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
        searchable={controls}
        searchPlaceholder="Buscar por descrição ou resumo..."
        searchFields={[
          (vote) => vote.description,
          (vote) => vote.summary ?? "",
          (vote) => vote.voteId,
          (vote) => vote.reason,
        ]}
        filters={controls ? filters : []}
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
