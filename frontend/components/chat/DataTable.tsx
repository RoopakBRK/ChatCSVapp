import type { ChatAnswer } from "@/lib/api";
import { formatCell } from "@/lib/chartFormat";

/** The rows of an answer, with the header kept in view while scrolling. */
export default function DataTable({ answer }: { answer: ChatAnswer }) {
  if (answer.rows.length === 0) return <p className="text-ui text-muted">The query returned no rows.</p>;
  return (
    <>
      <div className="max-h-80 overflow-auto rounded-lg border border-border">
        <table className="w-full whitespace-nowrap text-ui">
          <thead className="sticky top-0 bg-panel">
            <tr>
              {answer.columns.map((c) => (
                <th key={c} className="px-2 py-1 text-left font-mono font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {answer.rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {row.map((cell, j) => (
                  <td key={j} className={`px-2 py-1 ${typeof cell === "number" ? "text-right font-mono tabular-nums" : ""}`}>
                    {cell === null ? <span className="text-muted">null</span> : formatCell(answer.columns[j], cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {answer.truncated && (
        <p className="mt-2 text-ui text-muted">Showing the first {answer.row_count} rows; the full result is larger.</p>
      )}
    </>
  );
}
