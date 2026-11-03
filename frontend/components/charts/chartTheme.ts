import type { CellValue } from "@/lib/api";
import { formatValue } from "@/lib/format";

/** Blue-to-pink palette used for every series and slice. */
export const PALETTE = ["#6366f1", "#ec4899", "#0ea5e9", "#d946ef", "#14b8a6", "#f59e0b", "#8b5cf6", "#f43f5e"];
export const GRID = "rgba(129, 140, 248, 0.25)";
export const AXIS_TEXT = { fontSize: 11, fill: "currentColor" };
export const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid rgba(99,102,241,0.25)",
  background: "rgba(255,255,255,0.95)",
  color: "#1e1b4b",
  fontSize: 12,
};

export type Datum = Record<string, string | number | null>;

/** Turn result rows into objects for Recharts. The x column is made readable (dates, not timestamps). */
export function toRecords(columns: string[], rows: CellValue[][], x: string): Datum[] {
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((c, i) => {
        const v = row[i];
        if (c === x) return [c, formatValue(v)];
        return [c, typeof v === "number" || typeof v === "string" || v === null ? v : String(v)];
      }),
    ),
  );
}
