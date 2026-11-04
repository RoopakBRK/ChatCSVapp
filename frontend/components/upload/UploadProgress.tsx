import type { FileProgress } from "@/hooks/useFiles";
import { formatCount } from "@/lib/format";

const STAGES = ["reading", "cleaning", "ready"] as const;
const LABEL = { reading: "Reading", cleaning: "Cleaning", ready: "Ready" };

/** A card per file moving through reading → cleaning → ready (or showing why it failed). */
export default function UploadProgress({ items }: { items: FileProgress[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Files being added" aria-live="polite">
      {items.map((f) => {
        const at = f.stage === "error" ? -1 : STAGES.indexOf(f.stage);
        return (
          <li key={f.name} className="card depth msg-in rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate font-mono text-ui" title={f.name}>{f.name}</span>
              {f.stage === "ready" && f.rows !== undefined && <span className="font-mono text-ui text-muted">{formatCount(f.rows)} rows</span>}
            </div>
            {f.stage === "error" ? (
              <p className="mt-2 text-ui text-error-ink">{f.reason ?? "This file couldn't be used."}</p>
            ) : (
              <ol className="mt-2 flex items-center gap-2 text-ui">
                {STAGES.map((s, i) => {
                  const done = i < at || f.stage === "ready";
                  const active = i === at && f.stage !== "ready";
                  return (
                    <li key={s} className="flex items-center gap-2">
                      {i > 0 && <span className={`h-px w-6 ${i <= at ? "bg-chart-1" : "bg-border-strong"}`} aria-hidden />}
                      {done ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-chart-1 text-ui font-bold text-panel" aria-hidden>✓</span>
                      ) : active ? (
                        <span className="h-4 w-4 rounded-full border-2 border-accent-soft border-t-accent motion-safe:animate-spin" aria-hidden />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-border-strong" aria-hidden />
                      )}
                      <span className={active ? "shimmer font-medium" : done ? "text-foreground" : "text-muted"}>
                        {LABEL[s]}
                        {active && s === "reading" && f.sent !== undefined && f.sent < 1 && ` ${Math.round(f.sent * 100)}%`}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {f.stage === "reading" && f.sent !== undefined && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" aria-hidden>
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(f.sent * 100)}%` }} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
