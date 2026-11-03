import type { CellValue, ColumnInfo } from "@/lib/api";
import { formatValue } from "@/lib/format";

export default function SampleTable({ columns, rows }: { columns: ColumnInfo[]; rows: Record<string, CellValue>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.name} className="pr-3 text-left font-mono font-normal text-muted">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.name} className="py-0.5 pr-3">
                  {row[c.name] === null ? <span className="text-muted">null</span> : formatValue(row[c.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
