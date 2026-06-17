"use client"

import Image from "next/image"
import { useMemo } from "react"
import { FileCheck2, Scale, Target, Vote, Banknote } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PUBLIC_VALUE_WEIGHTS } from "@/lib/public-value"
import { cn } from "@/lib/utils"

type DimensionItem = {
  key: string
  label: string
  value: number | null
}

type CandidateData = {
  name: string
  slug: string
  photoUrl: string
  score: number | null
  dimensions: DimensionItem[]
}

type Props = {
  candidateA: CandidateData | null
  candidateB: CandidateData | null
}

const CRITERIA_ICONS: Record<string, { icon: typeof FileCheck2; label: string }> = {
  contribution: { icon: FileCheck2, label: "Proposições" },
  publicVotes: { icon: Vote, label: "Votações" },
  efficiency: { icon: Target, label: "Gastos" },
  participation: { icon: Scale, label: "Presença" },
  campaignFinance: { icon: Banknote, label: "Dados" },
}

type QualityBand = { min: number; max: number; label: string; class: string }

const QUALITY_BANDS: QualityBand[] = [
  { min: 0, max: 20, label: "Muito baixo", class: "bg-red-500" },
  { min: 21, max: 40, label: "Baixo", class: "bg-orange-500" },
  { min: 41, max: 60, label: "Médio", class: "bg-amber-400" },
  { min: 61, max: 80, label: "Alto", class: "bg-lime-500" },
  { min: 81, max: 100, label: "Muito alto", class: "bg-emerald-500" },
]

const QUALITY_TEXT_CLASS: Record<string, string> = {
  "Muito alto": "text-emerald-600 dark:text-emerald-400",
  Alto: "text-lime-600 dark:text-lime-400",
  Médio: "text-amber-600 dark:text-amber-400",
  Baixo: "text-orange-600 dark:text-orange-400",
  "Muito baixo": "text-red-600 dark:text-red-400",
}

function clampScore(s: number | null): number {
  if (s === null) return 0
  return Math.max(0, Math.min(100, Math.round(s)))
}

function getQualityBand(score: number | null): (typeof QUALITY_BANDS)[0] {
  const clamped = clampScore(score)
  for (const band of QUALITY_BANDS) {
    if (clamped >= band.min && clamped <= band.max) return band
  }
  return QUALITY_BANDS[4]
}

function getWinner(
  a: number | null,
  b: number | null,
): { winner: "A" | "B" | null; diff: number; isTie: boolean } {
  const scoreA = a ?? 0
  const scoreB = b ?? 0
  if (scoreA > scoreB) return { winner: "A", diff: scoreA - scoreB, isTie: false }
  if (scoreB > scoreA) return { winner: "B", diff: scoreB - scoreA, isTie: false }
  return { winner: null, diff: 0, isTie: true }
}

function SpectrumBar({
  scoreA,
  scoreB,
  nameA,
  nameB,
  photoA,
  photoB,
}: {
  scoreA: number | null
  scoreB: number | null
  nameA: string
  nameB: string
  photoA: string
  photoB: string
}) {
  const clampedA = clampScore(scoreA)
  const clampedB = clampScore(scoreB)
  const overlap = Math.abs(clampedA - clampedB) <= 4
  const offsetPx = 20

  return (
    <div className="relative h-12">
      <div className="absolute inset-x-0 top-1/2 flex h-2 -translate-y-1/2 overflow-hidden rounded-full">
        {QUALITY_BANDS.map((band) => (
          <div
            key={band.label}
            className={cn(band.class, "h-full")}
            style={{ width: `${band.max - band.min + 1}%` }}
            title={`${band.min}-${band.max}: ${band.label}`}
          />
        ))}
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full border-[3px] border-white bg-[#2563EB] shadow-md transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden"
              style={{
                left: `${clampedA}%`,
                zIndex: overlap && clampedA > clampedB ? 10 : 20,
              }}
              aria-label={`${nameA}: ${clampedA} pontos`}
            >
              <Image src={photoA} alt="" width={32} height={32} className="size-full object-cover" />
            </button>
          }
        />
        <TooltipContent side="top" align="center">
          <div className="flex items-center gap-2">
            <Image src={photoA} alt="" width={24} height={24} className="size-6 rounded-full object-cover" />
            <div>
              <p className="text-xs font-semibold">{nameA}</p>
              <p className="text-xs text-muted-foreground">{clampedA} pontos</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full border-[3px] border-white bg-[#7C3AED] shadow-md transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden"
              style={{
                left: `${clampedB}%`,
                top: overlap ? `calc(50% + ${offsetPx}px)` : "50%",
                zIndex: overlap && clampedB > clampedA ? 10 : 20,
              }}
              aria-label={`${nameB}: ${clampedB} pontos`}
            >
              <Image src={photoB} alt="" width={32} height={32} className="size-full object-cover" />
            </button>
          }
        />
        <TooltipContent side="top" align="center">
          <div className="flex items-center gap-2">
            <Image src={photoB} alt="" width={24} height={24} className="size-6 rounded-full object-cover" />
            <div>
              <p className="text-xs font-semibold">{nameB}</p>
              <p className="text-xs text-muted-foreground">{clampedB} pontos</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function QualityLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="font-medium text-muted-foreground">Faixas:</span>
      {QUALITY_BANDS.map((band) => (
        <span key={band.label} className="inline-flex items-center gap-1">
          <span className={cn("size-2.5 rounded-full", band.class)} />
          {band.label}
        </span>
      ))}
    </div>
  )
}

function CandidateLegend({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs">
      <span className="font-medium text-muted-foreground">Candidatos:</span>
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-[#2563EB]" />
        A = {nameA}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="size-2.5 rounded-full bg-[#7C3AED]" />
        B = {nameB}
      </span>
    </div>
  )
}

export function CriteriaSpectrumComparison({ candidateA, candidateB }: Props) {
  const dimensions = useMemo(() => {
    if (!candidateA || !candidateB) return []

    const mapA = new Map(candidateA.dimensions.map((d) => [d.key, d]))
    const mapB = new Map(candidateB.dimensions.map((d) => [d.key, d]))

    const keys = candidateA.dimensions.map((d) => d.key)

    return keys.map((key) => {
      const dimA = mapA.get(key)!
      const dimB = mapB.get(key)!
      const weight = PUBLIC_VALUE_WEIGHTS[key as keyof typeof PUBLIC_VALUE_WEIGHTS]
      const { winner, diff, isTie } = getWinner(dimA.value, dimB.value)
      const IconConfig = CRITERIA_ICONS[key]
      const Icon = IconConfig?.icon || FileCheck2

      return {
        key,
        label: dimA.label,
        valueA: dimA.value,
        valueB: dimB.value,
        weight,
        winner,
        diff,
        isTie,
        Icon,
        iconLabel: IconConfig?.label || "",
      }
    })
  }, [candidateA, candidateB])

  const bothSelected = candidateA && candidateB

  if (!bothSelected) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Comparativo por critérios</h2>
        <p className="text-sm text-muted-foreground">
          Selecione dois candidatos para ver a comparação por critérios.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Comparativo por critérios</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada critério é pontuado de 0 a 100 pontos, conforme a metodologia do índice.
        </p>
      </div>

      {/* Legend */}
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <QualityLegend />
        <CandidateLegend nameA={candidateA.name} nameB={candidateB.name} />
        <div className="flex items-center gap-3 text-xs">
          <span className="font-medium text-muted-foreground">Resultado:</span>
          <span className="inline-flex items-center gap-1">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
              Venceu
            </Badge>
            <span className="text-muted-foreground">candidato à frente</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 text-[10px] dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
              Empate
            </Badge>
            <span className="text-muted-foreground">mesma pontuação</span>
          </span>
        </div>
      </div>

      {/* Spectrum rows */}
      <div className="space-y-6">
        {dimensions.map((dim) => {
          const bandA = getQualityBand(dim.valueA)
          const bandB = getQualityBand(dim.valueB)

          return (
            <div key={dim.key} className="rounded-lg border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <dim.Icon className="size-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm">{dim.label}</span>
                  {dim.weight !== undefined && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button type="button" className="inline-flex items-center focus-visible:outline-none">
                            <Badge variant="secondary" className="text-[10px] font-normal cursor-default">
                              peso {Math.round(dim.weight * 100)}%
                            </Badge>
                          </button>
                        }
                      />
                      <TooltipContent side="top">
                        <p className="text-xs">Peso no score geral: {Math.round(dim.weight * 100)}%</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {dim.isTie ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 dark:border-gray-700 dark:bg-gray-900/30">
                      <div className="flex -space-x-1.5">
                        <Image src={candidateA.photoUrl} alt="" width={18} height={18} className="size-[18px] rounded-full border border-white object-cover" />
                        <Image src={candidateB.photoUrl} alt="" width={18} height={18} className="size-[18px] rounded-full border border-white object-cover" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">Empate</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 dark:border-emerald-900 dark:bg-emerald-950/30">
                      <Image
                        src={dim.winner === "A" ? candidateA.photoUrl : candidateB.photoUrl}
                        alt=""
                        width={18}
                        height={18}
                        className="size-[18px] rounded-full border border-white object-cover"
                      />
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        {dim.winner === "A" ? candidateA.name.split(" ")[0] : candidateB.name.split(" ")[0]} venceu
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <SpectrumBar
                scoreA={dim.valueA}
                scoreB={dim.valueB}
                nameA={candidateA.name}
                nameB={candidateB.name}
                photoA={candidateA.photoUrl}
                photoB={candidateB.photoUrl}
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-[#2563EB]" />
                    <span className="tabular-nums font-semibold">{dim.valueA ?? "—"}</span>
                    <span className={cn(QUALITY_TEXT_CLASS[bandA.label] || "text-muted-foreground")}>
                      · {bandA.label}
                    </span>
                  </span>
                  <span className="text-muted-foreground/50">|</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-[#7C3AED]" />
                    <span className="tabular-nums font-semibold">{dim.valueB ?? "—"}</span>
                    <span className={cn(QUALITY_TEXT_CLASS[bandB.label] || "text-muted-foreground")}>
                      · {bandB.label}
                    </span>
                  </span>
                </div>
                <span className={cn("tabular-nums", dim.isTie ? "text-muted-foreground" : "font-medium")}>
                  {dim.isTie
                    ? "0 pontos"
                    : `+${dim.diff} ${dim.diff === 1 ? "ponto" : "pontos"} para ${dim.winner === "A" ? candidateA.name.split(" ")[0] : candidateB.name.split(" ")[0]}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Critério</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">{candidateA.name}</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">{candidateB.name}</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Diferença</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Vencedor</th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dim) => {
              const bandA = getQualityBand(dim.valueA)
              const bandB = getQualityBand(dim.valueB)
              return (
                <tr key={dim.key} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{dim.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {dim.valueA !== null
                      ? `${dim.valueA} · ${bandA.label}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {dim.valueB !== null
                      ? `${dim.valueB} · ${bandB.label}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {dim.isTie ? "0" : `+${dim.diff}`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {dim.isTie ? (
                      <div className="inline-flex items-center gap-1">
                        <div className="flex -space-x-1">
                          <Image src={candidateA.photoUrl} alt="" width={16} height={16} className="size-4 rounded-full border border-white object-cover" />
                          <Image src={candidateB.photoUrl} alt="" width={16} height={16} className="size-4 rounded-full border border-white object-cover" />
                        </div>
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 text-[10px] dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                          Empate
                        </Badge>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <Image
                          src={dim.winner === "A" ? candidateA.photoUrl : candidateB.photoUrl}
                          alt=""
                          width={16}
                          height={16}
                          className="size-4 rounded-full border border-white object-cover"
                        />
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
                          {dim.winner === "A" ? candidateA.name.split(" ")[0] : candidateB.name.split(" ")[0]}
                        </Badge>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <a href="/metodologia" target="_blank" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
          <FileCheck2 className="size-3" /> Ver metodologia
        </a>
      </div>
    </div>
  )
}
