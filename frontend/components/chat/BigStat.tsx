import type { ChatAnswer } from "@/lib/api";
import { formatNumber, humanize } from "@/lib/chartFormat";

/** The single number, when an answer is just one number (one row, one numeric column). */
export function singleNumber(answer: ChatAnswer): { column: string; value: number } | null {
  if (answer.rows.length !== 1 || answer.columns.length !== 1) return null;
  const v = answer.rows[0][0];
  return typeof v === "number" ? { column: answer.columns[0], value: v } : null;
}

/** One number in a bordered box, with its label underneath. */
export default function BigStat({ column, value }: { column: string; value: number }) {
  return (
    <div className="inline-block rounded-[20px] bg-card px-4 py-3">
      <p className="font-mono text-head font-semibold tabular-nums">{formatNumber(column, value)}</p>
      <p className="text-ui text-muted">{humanize(column)}</p>
    </div>
  );
}
