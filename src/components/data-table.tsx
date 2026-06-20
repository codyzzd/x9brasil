"use client"

import { useState, useMemo } from "react"
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const DEFAULT_ITEMS_PER_PAGE = 15

export type SortState = { id: string; dir: "asc" | "desc" } | null

export type Column<T> = {
  id: string
  header: string
  cell: (item: T) => React.ReactNode
  sortable?: boolean
  sortValue?: (item: T) => string | number
  className?: string
  headerClassName?: string
}

export type FilterDef<T> = {
  id: string
  label: string
  options: { value: string; label: string }[]
  getValue: (item: T) => string
}

export type DataTableProps<T> = {
  columns: Column<T>[]
  data: T[]
  keyFn: (item: T, index: number) => string
  searchable?: boolean
  searchPlaceholder?: string
  searchFields?: ((item: T) => string)[]
  filters?: FilterDef<T>[]
  emptyMessage?: string
  itemsPerPage?: number
  paginationMode?: "client" | "none"
  footerMode?: "auto" | "hidden"
  sortMode?: "client" | "manual"
  sortState?: SortState
  onSortChange?: (sort: SortState) => void
  tableClassName?: string
}

export function DataTable<T>({
  columns,
  data,
  keyFn,
  searchable = true,
  searchPlaceholder = "Buscar...",
  searchFields,
  filters = [],
  emptyMessage = "Nenhum registro encontrado.",
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  paginationMode = "client",
  footerMode = "auto",
  sortMode = "client",
  sortState,
  onSortChange,
  tableClassName,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [internalSort, setInternalSort] = useState<SortState>(null)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const sort = sortState !== undefined ? sortState : internalSort

  const filtered = useMemo(() => {
    let result = data

    if (search && searchFields) {
      const q = search.toLowerCase()
      result = result.filter((item) =>
        searchFields.some((fn) => fn(item).toLowerCase().includes(q)),
      )
    }

    for (const filter of filters) {
      const value = activeFilters[filter.id]
      if (value) {
        result = result.filter((item) => filter.getValue(item) === value)
      }
    }

    return result
  }, [data, search, searchFields, filters, activeFilters])

  const sorted = useMemo(() => {
    if (!sort || sortMode === "manual") return filtered
    const col = columns.find((c) => c.id === sort.id)
    if (!col || !col.sortable) return filtered

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      const va = col.sortValue ? col.sortValue(a) : String(a[sort.id as keyof T] ?? "")
      const vb = col.sortValue ? col.sortValue(b) : String(b[sort.id as keyof T] ?? "")
      if (typeof va === "number" && typeof vb === "number") {
        return sort.dir === "asc" ? va - vb : vb - va
      }
      return sort.dir === "asc"
        ? String(va).localeCompare(String(vb), "pt-BR")
        : String(vb).localeCompare(String(va), "pt-BR")
    })
    return sorted
  }, [filtered, sort, columns, sortMode])

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage))
  const currentPage = Math.min(page, totalPages - 1)
  const paginated = paginationMode === "client"
    ? sorted.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage,
      )
    : sorted

  function handleSearch(value: string) {
    setSearch(value)
    setPage(0)
  }

  function handleFilterChange(filterId: string, value: string) {
    setActiveFilters((prev) => ({ ...prev, [filterId]: value }))
    setPage(0)
  }

  function toggleSort(columnId: string) {
    const nextSort = (() => {
      const prev = sort
      if (prev?.id === columnId) {
        return { id: columnId, dir: prev.dir === "asc" ? "desc" : "asc" }
      }
      return { id: columnId, dir: "asc" }
    })() satisfies Exclude<SortState, null>

    if (onSortChange) {
      onSortChange(nextSort)
      return
    }

    setInternalSort(nextSort)
  }

  if (!data.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    )
  }

  return (
    <div className="space-y-4">
      {(searchable || filters.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          )}
          {filters.map((filter) => {
            const filterOptions = [{ value: "", label: "Todas" }, ...filter.options]

            return (
              <Select
                key={filter.id}
                value={activeFilters[filter.id] || ""}
                items={filterOptions}
                onValueChange={(value) => handleFilterChange(filter.id, value ?? "")}
              >
                <SelectTrigger className="w-auto min-w-36">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          })}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table className={tableClassName}>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.sortable && "cursor-pointer select-none",
                    col.headerClassName,
                  )}
                  onClick={() => col.sortable && toggleSort(col.id)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <>
                        {sort?.id === col.id ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="size-3 shrink-0" />
                          ) : (
                            <ArrowDown className="size-3 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 shrink-0 opacity-40" />
                        )}
                      </>
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((item, index) => (
              <TableRow key={keyFn(item, index)}>
                {columns.map((col) => (
                  <TableCell key={col.id} className={cn("align-top", col.className)}>
                    {col.cell(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {footerMode !== "hidden" && (
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sorted.length} registro{sorted.length !== 1 ? "s" : ""}
          {search || Object.values(activeFilters).some(Boolean)
            ? " encontrado" + (sorted.length !== 1 ? "s" : "")
            : ""}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {currentPage + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Próximo
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
