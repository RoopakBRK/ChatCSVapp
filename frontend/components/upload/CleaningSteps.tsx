import type { CleaningStep } from "@/lib/api";
import { plainType } from "@/lib/format";

// "text → DECIMAL(18,2) (exact decimal...)" reads "text → decimal (...)".
const SQL_TYPE = /\b(BIGINT|INTEGER|DOUBLE|DECIMAL\(\d+,\s*\d+\)|DATE|TIMESTAMP|BOOLEAN|VARCHAR)\b/g;
const plainDetail = (detail: string) => detail.replace(SQL_TYPE, (t) => plainType(t));

export default function CleaningSteps({ steps }: { steps: CleaningStep[] }) {
  if (steps.length === 0) return <p className="text-muted">Nothing needed cleaning.</p>;
  const ordered = [...steps.filter((s) => s.changes_data), ...steps.filter((s) => !s.changes_data)];
  return (
    <ul className="space-y-1">
      {ordered.map((s, i) => (
        <li key={i} className="text-muted">
          <span className={s.changes_data ? "font-medium text-teal" : "font-medium text-accent-ink"}>
            {s.changes_data ? "Changed" : "Flagged"}
          </span>
          {s.column && <span className="font-mono text-foreground"> {s.column}</span>}: {plainDetail(s.detail)}
        </li>
      ))}
    </ul>
  );
}
