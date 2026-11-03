import type { CellValue } from "@/lib/api";
import { formatCell, humanize } from "@/lib/chartFormat";

type Props = { columns: string[]; rows: CellValue[][]; height: number };

/** The result as a table: currency and thousands formatted, numbers right-aligned, header stays in view. */
export default function ChartTable({ columns, rows, height }: Props) {
  return (
    <div className="overflow-auto rounded-lg border border-border" style={{ maxHeight: height }}>
      <table className="w-full whitespace-nowrap text-xs">
        <thead className="sticky top-0 bg-panel">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-1.5 text-left font-semibold text-muted">
                {humanize(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-1.5 ${typeof cell === "number" ? "text-right font-mono tabular-nums" : ""}`}>
                  {cell === null ? <span className="text-muted">null</span> : formatCell(columns[j], cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
