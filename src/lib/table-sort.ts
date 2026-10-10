import { useState } from "react";

export type SortDir = "asc" | "desc";
export type SortValue = string | number | null | undefined;
/** One sortable column: how to read its value, and which way the first click sorts. */
export type SortColumn<T> = { value: (row: T) => SortValue; first?: SortDir };

export function compareValues(a: SortValue, b: SortValue): number {
  // Empty values always sink to the bottom, whichever way the column is sorted.
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

export function sortRows<T>(rows: T[], column: SortColumn<T> | undefined, dir: SortDir): T[] {
  if (!column) return rows;
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, v: column.value(row) }))
    .sort((x, y) => {
      const empty = (v: SortValue) => v == null || v === "";
      if (empty(x.v) || empty(y.v)) return compareValues(x.v, y.v) || x.index - y.index;
      return sign * compareValues(x.v, y.v) || x.index - y.index;
    })
    .map((x) => x.row);
}

/** Click a header to sort by it; click again to flip; a third click returns to the original order. */
export function useTableSort<T, K extends string>(columns: Record<K, SortColumn<T>>) {
  const [sort, setSort] = useState<{ key: K; dir: SortDir } | null>(null);
  const toggle = (key: K) =>
    setSort((s) => {
      const first = columns[key].first ?? "asc";
      if (!s || s.key !== key) return { key, dir: first };
      if (s.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
      return null;
    });
  const apply = (rows: T[]) => (sort ? sortRows(rows, columns[sort.key], sort.dir) : rows);
  const ariaSort = (key: K): "ascending" | "descending" | "none" =>
    sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  return { sort, toggle, apply, ariaSort };
}
