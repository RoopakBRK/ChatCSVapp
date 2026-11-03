import type { ChatAnswer } from "@/lib/api";
import { formatNumber, humanize } from "@/lib/chartFormat";

/** The single number, when an answer is just one number (one row, one numeric column). */
export function singleNumber(answer: ChatAnswer): { column: string; value: number } | null {
  if (answer.rows.length !== 1 || answer.columns.length !== 1) return null;
  const v = answer.rows[0][0];
  return typeof v === "number" ? { column: answer.columns[0], value: v } : null;
}

/** A big number in Geist Mono with a short label underneath. */
export default function BigStat({ column, value }: { column: string; value: number }) {
  return (
    <div className="chart-stage rounded-2xl px-5 py-6 text-center">
      <p className="font-mono text-5xl font-medium tracking-tight tabular-nums text-foreground sm:text-6xl">{formatNumber(column, value)}</p>
      <p className="mt-2 text-xs uppercase tracking-wider text-muted">{humanize(column)}</p>
    </div>
  );
}
