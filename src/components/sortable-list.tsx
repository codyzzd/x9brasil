"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};

function formatCurrency(value: number | null) {
  if (value === null) return "Valor indisponível";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SortableMoneyList({
  rows,
}: {
  rows: Array<{ label: string; value: number; detail: string }>;
}) {
  const [sort, setSort] = useState<SortConfig>({ key: "value", direction: "desc" });

  const sorted = useMemo(() => {
    const sortedRows = [...rows];
    sortedRows.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "label") {
        cmp = a.label.localeCompare(b.label, "pt-BR");
      } else if (sort.key === "value") {
        cmp = a.value - b.value;
      } else if (sort.key === "detail") {
        cmp = a.detail.localeCompare(b.detail, "pt-BR");
      }
      return sort.direction === "desc" ? -cmp : cmp;
    });
    return sortedRows;
  }, [rows, sort]);

  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Dados indisponíveis no período.</p>;

  function toggle(key: string) {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  function renderSortIcon(columnKey: string) {
    if (sort.key !== columnKey) return <ArrowUpDown className="size-3" />;
    return sort.direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
  }

  return (
    <div className="rounded-lg border">
      <div className="grid gap-2 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_auto_auto]">
        <button
          type="button"
          onClick={() => toggle("label")}
          className="flex items-center gap-1 text-left hover:text-foreground"
        >
          Fornecedor {renderSortIcon("label")}
        </button>
        <button
          type="button"
          onClick={() => toggle("detail")}
          className="flex items-center gap-1 text-left hover:text-foreground"
        >
          Documentos {renderSortIcon("detail")}
        </button>
        <button
          type="button"
          onClick={() => toggle("value")}
          className="flex items-center gap-1 justify-end hover:text-foreground"
        >
          Total {renderSortIcon("value")}
        </button>
      </div>
      <div className="divide-y">
        {sorted.map((row) => (
          <div
            key={`${row.label}-${row.detail}`}
            className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto]"
          >
            <p className="font-medium text-pretty">{row.label}</p>
            <p className="text-xs text-muted-foreground self-center">{row.detail}</p>
            <p className="font-semibold tabular-nums text-right">{formatCurrency(row.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
