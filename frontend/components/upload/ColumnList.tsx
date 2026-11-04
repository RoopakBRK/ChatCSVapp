import type { ColumnInfo } from "@/lib/api";
import { formatCount, plainType } from "@/lib/format";

/** Each column: the cleaned name used in questions, the original CSV header, and a plain type. */
export default function ColumnList({ columns }: { columns: ColumnInfo[] }) {
  return (
    <table className="w-full">
      <thead className="text-left text-muted">
        <tr>
          <th className="py-1 pr-2 font-medium">Column</th>
          <th className="py-1 pr-2 font-medium">CSV header</th>
          <th className="py-1 pr-2 font-medium">Type</th>
          <th className="py-1 text-right font-medium">Missing</th>
        </tr>
      </thead>
      <tbody>
        {columns.map((c) => (
          <tr key={c.name} className="align-top">
            <td className="truncate py-1 pr-2 font-mono">{c.name}</td>
            <td className="truncate py-1 pr-2">{c.original_name}</td>
            <td className="py-1 pr-2 text-muted">{plainType(c.type)}</td>
            <td className="py-1 text-right text-muted">{c.missing > 0 ? `${formatCount(c.missing)} (${c.missing_pct}%)` : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
