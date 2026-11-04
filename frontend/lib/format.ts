import type { CellValue, CleaningStep } from "@/lib/api";

const nf = new Intl.NumberFormat();
const MIDNIGHT = /^(\d{4}-\d{2}-\d{2})T00:00:00$/;

/** Human-friendly text for a table cell or axis label. */
export function formatValue(v: CellValue | undefined): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : nf.format(Number(v.toFixed(4)));
  if (typeof v === "string") return v.replace(MIDNIGHT, "$1");
  return String(v);
}

export function formatCount(n: number): string {
  return nf.format(n);
}

/** Short number for chart axes: 1.2M, 15.2K. */
export function compactNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** One-line description of what the cleaner did, e.g. "2 duplicate rows removed · 3 columns typed". */
export function cleaningHeadline(steps: CleaningStep[]): string {
  const total = (action: string) => steps.filter((s) => s.action === action).reduce((n, s) => n + s.count, 0);
  const columns = (action: string) => steps.filter((s) => s.action === action).length;
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => n > 0 && parts.push(`${formatCount(n)} ${n === 1 ? one : many}`);

  add(total("drop_duplicate_rows"), "duplicate row removed", "duplicate rows removed");
  add(total("drop_empty_rows"), "empty row removed", "empty rows removed");
  add(columns("rename_column"), "column renamed", "columns renamed");
  add(columns("convert_type"), "column typed", "columns typed");
  add(total("trim_whitespace"), "cell trimmed", "cells trimmed");
  add(total("blank_to_null") + total("null_token_to_null"), "blank kept as null", "blanks kept as null");
  add(columns("flag_outliers"), "column with outliers flagged", "columns with outliers flagged");
  return parts.join(" · ") || "Nothing needed cleaning";
}

/** A type name anyone can read (the backend's _columns table uses the same words). */
export function plainType(sqlType: string): string {
  const t = sqlType.toUpperCase();
  if (/^(BIG|SMALL|TINY|HUGE|U)?INT(EGER)?$|^UBIGINT$/.test(t)) return "number";
  if (t.startsWith("DECIMAL") || ["DOUBLE", "FLOAT", "REAL"].includes(t)) return "decimal";
  if (t === "DATE") return "date";
  if (t.startsWith("TIMESTAMP")) return "date and time";
  if (t === "BOOLEAN") return "true/false";
  return "text";
}
