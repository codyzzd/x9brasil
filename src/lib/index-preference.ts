import type { RankingIndex } from "@/lib/ranking";

const STORAGE_KEY = "x9-indice";

export function getStoredIndex(): RankingIndex {
  return "public-value";
}

export function setStoredIndex(_value: RankingIndex): void {
  localStorage.setItem(STORAGE_KEY, "public-value");
}

export function getIndexFromParam(_param: string | undefined): RankingIndex {
  return "public-value";
}
