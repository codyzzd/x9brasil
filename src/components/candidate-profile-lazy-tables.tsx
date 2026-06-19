"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"

import { ProposalsTable } from "@/components/proposals-table"
import {
  PublicVotesTable,
  VoteDistributionBar,
  VotePositioningBar,
} from "@/components/candidate-data-tables"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ProposalRows = Parameters<typeof ProposalsTable>[0]["proposals"]
type PublicVoteRows = Parameters<typeof PublicVotesTable>[0]["data"]
type Section = "proposals" | "votes"

type LazyTablesProps = {
  candidateSlug: string
  periodId: string
}

type PagedResult<T> = {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 15
const pageCache = new Map<string, Promise<PagedResult<unknown>> | PagedResult<unknown>>()

function useVisible() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return { ref, visible }
}

function loadSection<T>({
  candidateSlug,
  periodId,
  section,
  page,
  search,
}: LazyTablesProps & { section: Section; page: number; search: string }) {
  const params = new URLSearchParams({
    periodo: periodId,
    section,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  })
  if (search) params.set("search", search)

  const key = `${candidateSlug}:${params.toString()}`
  const cached = pageCache.get(key)
  if (cached) return Promise.resolve(cached as PagedResult<T> | Promise<PagedResult<T>>)

  const request = fetch(`/api/candidatos/${encodeURIComponent(candidateSlug)}/profile-tables?${params.toString()}`)
    .then((response) => {
      if (!response.ok) throw new Error("Falha ao carregar dados")
      return response.json() as Promise<PagedResult<T>>
    })
    .then((data) => {
      pageCache.set(key, data as PagedResult<unknown>)
      return data
    })

  pageCache.set(key, request as Promise<PagedResult<unknown>>)
  return request
}

function usePagedSection<T>(
  props: LazyTablesProps & { section: Section },
  enabled: boolean,
) {
  const { candidateSlug, periodId, section } = props
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [result, setResult] = useState<PagedResult<T>>({
    rows: [],
    total: 0,
    page: 0,
    pageSize: PAGE_SIZE,
  })
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    if (!enabled) return
    let active = true

    loadSection<T>({ candidateSlug, periodId, section, page, search })
      .then((data) => {
        if (!active) return
        setResult(data)
        setStatus("ready")
      })
      .catch(() => {
        if (!active) return
        setStatus("error")
      })

    return () => {
      active = false
    }
  }, [candidateSlug, periodId, section, page, search, enabled])

  function submitSearch() {
    setPage(0)
    setSearch(searchInput.trim())
  }

  return {
    page,
    setPage,
    searchInput,
    setSearchInput,
    submitSearch,
    result,
    status,
  }
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function RemoteControls({
  total,
  page,
  pageSize,
  searchInput,
  setSearchInput,
  submitSearch,
  setPage,
  noun,
}: {
  total: number
  page: number
  pageSize: number
  searchInput: string
  setSearchInput: (value: string) => void
  submitSearch: () => void
  setPage: (page: number) => void
  noun: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <form
        className="relative min-w-56 flex-1"
        onSubmit={(event) => {
          event.preventDefault()
          submitSearch()
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={`Buscar ${noun}...`}
          className="pl-8"
        />
      </form>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {total} registro{total !== 1 ? "s" : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 0}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {page + 1} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Próximo
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function LazyProposalsTable(props: LazyTablesProps) {
  const { ref, visible } = useVisible()
  const state = usePagedSection<ProposalRows[number]>({ ...props, section: "proposals" }, visible)

  if (!visible || state.status === "loading") return <div ref={ref}><LoadingState label="Carregando proposições..." /></div>
  if (state.status === "error") return <div ref={ref}><LoadingState label="Não foi possível carregar as proposições." /></div>

  return (
    <div ref={ref}>
      <RemoteControls
        total={state.result.total}
        page={state.page}
        pageSize={state.result.pageSize}
        searchInput={state.searchInput}
        setSearchInput={state.setSearchInput}
        submitSearch={state.submitSearch}
        setPage={state.setPage}
        noun="proposições"
      />
      {state.result.rows.length ? (
        <ProposalsTable proposals={state.result.rows} controls={false} />
      ) : (
        <LoadingState label="Nenhuma proposta encontrada no período." />
      )}
    </div>
  )
}

export function LazyVotePositioningBar(props: LazyTablesProps) {
  const { ref, visible } = useVisible()
  const state = usePagedSection<PublicVoteRows[number]>({ ...props, section: "votes" }, visible)

  if (!visible || state.status !== "ready" || !state.result.rows.length) return <div ref={ref} />
  return <div ref={ref}><VotePositioningBar data={state.result.rows} /></div>
}

export function LazyPublicVotesTable(props: LazyTablesProps) {
  const { ref, visible } = useVisible()
  const state = usePagedSection<PublicVoteRows[number]>({ ...props, section: "votes" }, visible)

  if (!visible || state.status === "loading") return <div ref={ref}><LoadingState label="Carregando votações..." /></div>
  if (state.status === "error") return <div ref={ref}><LoadingState label="Não foi possível carregar as votações." /></div>

  return (
    <div ref={ref}>
      <RemoteControls
        total={state.result.total}
        page={state.page}
        pageSize={state.result.pageSize}
        searchInput={state.searchInput}
        setSearchInput={state.setSearchInput}
        submitSearch={state.submitSearch}
        setPage={state.setPage}
        noun="votações"
      />
      {state.result.rows.length ? (
        <>
          <VoteDistributionBar data={state.result.rows} />
          <div className="mt-5">
            <PublicVotesTable data={state.result.rows} controls={false} />
          </div>
        </>
      ) : (
        <LoadingState label="Nenhuma votação nominal encontrada no período." />
      )}
    </div>
  )
}
