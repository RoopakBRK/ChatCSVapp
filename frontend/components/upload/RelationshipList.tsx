import type { Relationship } from "@/lib/api";

export default function RelationshipList({ relationships }: { relationships: Relationship[] }) {
  if (relationships.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Links between tables ({relationships.length})
      </h2>
      <ul className="space-y-1.5 text-xs">
        {relationships.map((r) => (
          <li key={r.join} className="rounded-xl border border-border bg-glass-strong px-3 py-2">
            <span className="font-mono">{r.join}</span>
            <span className="block text-muted">
              {r.cardinality === "one_to_one" ? "one-to-one" : "many-to-one"} · {r.match_pct}% match
              {r.unmatched_values > 0 && ` · ${r.unmatched_values} unmatched`} · {r.confidence} confidence
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
