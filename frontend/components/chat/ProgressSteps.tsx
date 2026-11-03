import { Fragment } from "react";
import type { ChatStep } from "@/lib/api";

const STEPS: { key: ChatStep; label: string }[] = [
  { key: "understanding", label: "Understanding question" },
  { key: "running", label: "Running query" },
  { key: "writing", label: "Writing answer" },
];

type Props = { step: ChatStep | null; onStop: () => void };

function Marker({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done")
    return (
      <span className="bg-gradient-brand flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white" aria-hidden>
        ✓
      </span>
    );
  if (state === "active")
    return <span className="h-5 w-5 rounded-full border-2 border-pink-300 border-t-sky-400 motion-safe:animate-spin" aria-hidden />;
  return <span className="h-5 w-5 rounded-full border-2 border-slate-200" aria-hidden />;
}

/** Where the answer is at, with a way to stop it. */
export default function ProgressSteps({ step, onStop }: Props) {
  const current = Math.max(0, STEPS.findIndex((s) => s.key === step));
  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
      {STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <Fragment key={s.key}>
            <span className={`flex items-center gap-1.5 text-sm ${state === "pending" ? "text-muted" : "font-medium"}`}>
              <Marker state={state} />
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-muted" aria-hidden>→</span>}
          </Fragment>
        );
      })}
      <button
        onClick={onStop}
        className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:border-pink-300 hover:bg-pink-50"
      >
        <span className="h-2.5 w-2.5 rounded-sm bg-pink-500" aria-hidden />
        Stop
      </button>
    </div>
  );
}
