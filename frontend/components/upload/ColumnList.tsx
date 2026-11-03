import type { ColumnInfo } from "@/lib/api";
import { formatCount } from "@/lib/format";

export default function ColumnList({ columns }: { columns: ColumnInfo[] }) {
  return (
    <table className="w-full">
      <tbody>
        {columns.map((c) => (
          <tr key={c.name} className="align-top">
            <td className="truncate py-0.5 pr-2 font-mono" title={c.original_name !== c.name ? `was: ${c.original_name}` : undefined}>
              {c.name}
            </td>
            <td className="py-0.5 pr-2 text-muted">{c.type}</td>
            <td className="py-0.5 text-right text-muted">
              {c.missing > 0 ? `${formatCount(c.missing)} null (${c.missing_pct}%)` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
