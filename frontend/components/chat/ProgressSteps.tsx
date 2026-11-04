"use client";

import { useEffect, useState } from "react";
import type { ChatStep } from "@/lib/api";

const STEPS: { key: ChatStep; label: string }[] = [
  { key: "reading", label: "Reading tables" },
  { key: "querying", label: "Writing the query" },
  { key: "running", label: "Running it" },
  { key: "explaining", label: "Explaining" },
];
const SLOW_AFTER_SECONDS = 20;

/** One quiet line: the current step shimmers; the composer's button stops it. */
export default function ProgressSteps({ step }: { step: ChatStep | null }) {
  const current = Math.max(0, STEPS.findIndex((s) => s.key === step));
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div role="status" aria-live="polite" className="msg-in flex items-center gap-2 text-ui">
      <span className="h-4 w-4 shrink-0 rounded-full border-2 border-accent-soft border-t-accent motion-safe:animate-spin" aria-hidden />
      <span className="shimmer font-medium">{STEPS[current].label}…</span>
      <span className="text-muted">
        {current + 1}/{STEPS.length}
        {seconds >= SLOW_AFTER_SECONDS && " · taking longer than usual"}
      </span>
    </div>
  );
}
