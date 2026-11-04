"use client";

import { useMemo } from "react";
import { defaultKind, type ChartKind } from "@/components/charts/chartKinds";
import { buildContext } from "@/components/charts/figureContext";
import type { ChatAnswer } from "@/lib/api";
import { formatCount } from "@/lib/format";

/** How each view reads in the chip: "line chart", "bar chart", "box plot"... */
const CHIP: Record<ChartKind, string> = {
  bar: "bar chart", line: "line chart", pie: "donut chart", scatter: "scatter plot", funnel: "funnel chart",
  treemap: "treemap", radar: "radar chart", histogram: "histogram", box: "box plot", table: "table",
};

type Props = { answer: ChatAnswer; kind?: ChartKind; stat: boolean; active: boolean; onClick: () => void };

/** "line chart · 12 rows": opens the answer in results; highlighted while it is the one shown. */
export default function ResultChip({ answer, kind, stat, active, onClick }: Props) {
  const ctx = useMemo(() => buildContext(answer), [answer]);
  const view = stat ? null : (kind ?? (ctx && answer.chart ? defaultKind(answer.chart.type, ctx) : "table"));
  const what = stat ? "number" : CHIP[view!];
  const rows = `${formatCount(answer.row_count)}${answer.truncated ? "+" : ""} row${answer.row_count === 1 ? "" : "s"}`;

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={active ? "Shown in results" : "Show in results"}
      className={`chip ${active ? "chip-active" : ""}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
      {what} · {rows}
    </button>
  );
}
