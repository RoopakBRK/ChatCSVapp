"use client";

import { useEffect, useState } from "react";
import type { ChatStep } from "@/lib/api";

const STEPS: { key: ChatStep; label: string }[] = [
  { key: "reading", label: "Reading tables" },
  { key: "querying", label: "Writing the query" },
  { key: "running", label: "Running it" },
  { key: "explaining", label: "Explaining the result" },
];
const SLOW_AFTER_SECONDS = 20;

/** What is happening right now: finished steps get a teal check, the current one shimmers. */
export default function ProgressSteps({ step, onStop }: { step: ChatStep | null; onStop: () => void }) {
  const current = Math.max(0, STEPS.findIndex((s) => s.key === step));
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div role="status" aria-live="polite" className="card depth msg-in rounded-2xl px-4 py-3">
      <div className="flex items-start gap-4">
        <ol className="flex-1 space-y-1.5">
          {STEPS.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s.key} className="flex items-center gap-2.5 text-sm">
                {done ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-chart-1 text-[9px] font-bold text-panel" aria-hidden>
                    ✓
                  </span>
                ) : active ? (
                  <span className="h-4 w-4 rounded-full border-2 border-accent-soft border-t-accent motion-safe:animate-spin" aria-hidden />
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-border-strong" aria-hidden />
                )}
                <span className={done ? "text-muted" : active ? "shimmer font-medium" : "text-muted"}>
                  {s.label}
                  {active && "…"}
                </span>
                {done && <span className="sr-only">(done)</span>}
              </li>
            );
          })}
        </ol>
        <button onClick={onStop} className="btn-ghost flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
          <span className="h-2.5 w-2.5 rounded-sm bg-error" aria-hidden />
          Stop
        </button>
      </div>
      {seconds >= SLOW_AFTER_SECONDS && (
        <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
          This is taking longer than usual ({seconds}s). The AI service may be busy; you can keep waiting or stop.
        </p>
      )}
    </div>
  );
}
