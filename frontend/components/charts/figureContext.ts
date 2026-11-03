import type { ChatAnswer } from "@/lib/api";
import { buildFormat, detectDateAxis, isMoneyColumn, type ChartFormat, type DateAxis } from "@/lib/chartFormat";

/** Everything the chart builders need, worked out once per answer. */
export type FigureContext = {
  x: (string | number)[]; // raw x values (ISO dates stay strings, so Plotly can treat them as dates)
  labels: string[]; // short x labels for ticks
  full: string[]; // complete x labels for tooltips
  y: number[];
  yText: string[]; // y values formatted for tooltips ($1,234.50 or 1,234)
  xKind: "category" | "date" | "number";
  dateAxis: DateAxis | null;
  money: boolean;
  /** Can the values be added up into a meaningful total? Not for averages, medians, min/max or rates. */
  additive: boolean;
  xTitle: string;
  yTitle: string;
  fmt: ChartFormat;
};

export function buildContext(answer: ChatAnswer): FigureContext | null {
  const chart = answer.chart;
  if (!chart) return null;
  const xi = answer.columns.indexOf(chart.x);
  const yi = answer.columns.indexOf(chart.y);
  if (xi < 0 || yi < 0) return null;

  // Rows without a numeric y can't be drawn; they are still in the data table.
  const rows = answer.rows.filter((r) => typeof r[yi] === "number" && r[xi] !== null);
  if (rows.length === 0) return null;
  const fmt = buildFormat(answer.columns, rows, chart.x, chart.y);
  const xs = rows.map((r) => (typeof r[xi] === "number" ? (r[xi] as number) : String(r[xi])));
  const dateAxis = detectDateAxis(xs.map(String));
  const xKind = dateAxis ? "date" : xs.every((v) => typeof v === "number") ? "number" : "category";
  const y = rows.map((r) => r[yi] as number);

  return {
    x: xs,
    labels: xs.map((v) => fmt.xTick(v)),
    full: xs.map((v) => fmt.xFull(v)),
    y,
    yText: y.map((v) => fmt.yFull(v)),
    xKind,
    dateAxis,
    money: isMoneyColumn(chart.y),
    additive: isAdditive(chart.y, answer.sql),
    xTitle: fmt.xLabel,
    yTitle: fmt.yLabel,
    fmt,
  };
}

const NON_ADDITIVE_NAME = /(^|_)(avg|average|mean|median|min|max|rate|ratio|pct|percent|share)(_|$)/i;

/** True when the y values can be summed: a count or a total, not an average or a rate. */
export function isAdditive(y: string, sql: string): boolean {
  if (NON_ADDITIVE_NAME.test(y)) return false;
  const alias = y.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // e.g. "AVG(price) AS typical_price": the alias hides the function, so look at the SQL too.
  const made = new RegExp(`\\b(avg|mean|median|min|max|quantile\\w*|stddev\\w*)\\s*\\([^)]*\\)\\s+(as\\s+)?"?${alias}"?\\b`, "i");
  return !made.test(sql);
}

/** Round, evenly spaced tick values covering lo..hi (like 0, 1M, 2M, 3M, 4M). */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (hi === lo) hi = lo + (lo === 0 ? 1 : Math.abs(lo) * 0.1);
  const raw = (hi - lo) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = (raw / pow >= 7.5 ? 10 : raw / pow >= 3.5 ? 5 : raw / pow >= 1.5 ? 2 : 1) * pow;
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return ticks;
}

/** Ticks for the value axis, starting at zero unless the data is negative. */
export function valueTicks(c: FigureContext, fromZero = true) {
  const lo = fromZero ? Math.min(0, ...c.y) : Math.min(...c.y);
  const vals = niceTicks(lo, Math.max(fromZero ? 0 : -Infinity, ...c.y));
  return { vals, text: vals.map((v) => c.fmt.yTick(v)), range: [vals[0], vals[vals.length - 1]] as [number, number] };
}
