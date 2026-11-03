import type { CellValue } from "@/lib/api";
import { formatValue } from "@/lib/format";

/** Fixed locale and currency so charts read the same for everyone (1,234.50 and $1,234.50). */
const LOCALE = "en-US";
const CURRENCY = "USD";

// A column is treated as money by its name. Counts, rates and ratings are not money even if they say "total".
const MONEY = /price|revenue|amount|total|cost|sales|spend|spent|income|profit|fee|salary|balance|payment/i;
const NOT_MONEY = /count|qty|quantity|number|items|units|orders|days|rating|score|percent|pct|rate|ratio/i;
// Identifiers and calendar parts must never get thousands separators (order 7,324 or the year 2,024).
const PLAIN = /(^|_)(id|key|code|zip|year|month|day|phone|no|num)$/i;

export const isMoneyColumn = (name: string) => MONEY.test(name) && !NOT_MONEY.test(name);
export const isPlainNumberColumn = (name: string) => PLAIN.test(name);

export function humanize(name: string): string {
  const s = name.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const moneyCompact = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, notation: "compact", maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const plainCompact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });

/** A number for a given column: currency for money columns, thousands separators otherwise. */
export function formatNumber(column: string, n: number, compact = false): string {
  if (!Number.isFinite(n)) return "";
  if (isPlainNumberColumn(column)) return String(n);
  if (isMoneyColumn(column)) return (compact ? moneyCompact : money).format(n);
  return (compact ? plainCompact : plain).format(n);
}

/** Text for a table cell. */
export function formatCell(column: string, v: CellValue | undefined): string {
  return typeof v === "number" ? formatNumber(column, v) : formatValue(v);
}

/* ───────────── dates on an axis ───────────── */

export type DateAxis = { granularity: "year" | "month" | "day" | "time"; multiYear: boolean };
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

/** If every value is an ISO date or timestamp, work out whether the axis is yearly, monthly, daily or timed. */
export function detectDateAxis(values: CellValue[]): DateAxis | null {
  const parts = values.filter((v) => v !== null).map((v) => (typeof v === "string" ? ISO.exec(v) : null));
  if (parts.length === 0 || parts.some((m) => m === null)) return null;
  const found = parts as RegExpExecArray[];

  const years = new Set(found.map((m) => m[1]));
  const firstOfMonth = found.every((m) => m[3] === "01");
  const firstOfYear = firstOfMonth && found.every((m) => m[2] === "01");
  const hasTime = found.some((m) => m[4] !== undefined && (m[4] !== "00" || m[5] !== "00"));

  const granularity = hasTime ? "time" : firstOfYear ? "year" : firstOfMonth ? "month" : "day";
  return { granularity, multiYear: years.size > 1 };
}

/** "Nov 2024", "Nov 3", "2024"... `long` is for tooltips, where there is room for the full date. */
export function formatDate(iso: string, axis: DateAxis, long = false): string {
  const m = ISO.exec(iso);
  if (!m) return iso;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  const fmt = (o: Intl.DateTimeFormatOptions) => date.toLocaleString(LOCALE, o);
  switch (axis.granularity) {
    case "year":
      return fmt({ year: "numeric" });
    case "month":
      return fmt({ month: long ? "long" : "short", year: "numeric" });
    case "day":
      return fmt({ month: "short", day: "numeric", ...(long || axis.multiYear ? { year: "numeric" } : {}) });
    case "time":
      return fmt({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(long || axis.multiYear ? { year: "numeric" } : {}) });
  }
}

/* ───────────── everything a chart needs to label itself ───────────── */

export type ChartFormat = {
  xLabel: string;
  yLabel: string;
  xTick: (v: unknown) => string; // short, for axis ticks
  xFull: (v: unknown) => string; // complete, for tooltips
  yTick: (n: unknown) => string;
  yFull: (n: unknown) => string;
};

const shorten = (s: string, max = 16) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function buildFormat(columns: string[], rows: CellValue[][], x: string, y: string): ChartFormat {
  const axis = detectDateAxis(rows.map((r) => r[columns.indexOf(x)]));
  return {
    xLabel: humanize(x),
    yLabel: humanize(y),
    xTick: (v) => (axis ? formatDate(String(v), axis) : shorten(String(v))),
    xFull: (v) => (axis ? formatDate(String(v), axis, true) : String(v)),
    yTick: (n) => formatNumber(y, Number(n), true),
    yFull: (n) => formatNumber(y, Number(n)),
  };
}
