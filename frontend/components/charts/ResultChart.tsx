"use client";

import type { ChatAnswer } from "@/lib/api";
import BarChartView from "./BarChartView";
import LineChartView from "./LineChartView";
import PieChartView from "./PieChartView";
import { toRecords } from "./chartTheme";

/** Draws the chart the backend suggested. Renders nothing when there is no chart. */
export default function ResultChart({ answer }: { answer: ChatAnswer }) {
  const { chart } = answer;
  if (!chart) return null;
  const data = toRecords(answer.columns, answer.rows, chart.x);
  const View = { bar: BarChartView, line: LineChartView, pie: PieChartView }[chart.type];

  return (
    <figure className="rounded-xl border border-border bg-glass-strong p-3">
      <figcaption className="mb-2 text-sm font-semibold">{chart.title}</figcaption>
      <View data={data} x={chart.x} y={chart.y} />
    </figure>
  );
}
