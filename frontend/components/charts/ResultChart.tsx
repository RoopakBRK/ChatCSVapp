"use client";

import { useMemo, useRef, useState } from "react";
import type { ChatAnswer } from "@/lib/api";
import ChartAsk from "./ChartAsk";
import ChartTable from "./ChartTable";
import ChartToolbar from "./ChartToolbar";
import { buildFigure, defaultKind, suitableKinds, type ChartKind } from "./chartKinds";
import { downloadCsv, downloadPng } from "./exportChart";
import { buildContext } from "./figureContext";
import PlotlyChart from "./plotly/PlotlyChart";

type Props = {
  answer: ChatAnswer;
  /** The view to show. When missing, the model's suggestion is used. */
  kind?: ChartKind;
  onKind?: (kind: ChartKind) => void;
  /** "inline" is the compact version; "card" is the results-panel version. */
  variant?: "card" | "inline";
};

/** One chart for one answer. Other views are offered as a question, never drawn all at once. */
export default function ResultChart({ answer, kind, onKind, variant = "card" }: Props) {
  const ctx = useMemo(() => buildContext(answer), [answer]);
  const current: ChartKind | null = ctx && answer.chart ? (kind ?? defaultKind(answer.chart.type, ctx)) : null;
  const inline = variant === "inline";
  const height = inline ? 320 : 380;
  const figure = useMemo(
    () => (ctx && current && current !== "table" ? buildFigure(current, ctx, height) : null),
    [ctx, current, height],
  );
  const box = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!ctx || !current || !answer.chart) return null;

  const title = answer.chart.title;
  const exportPng = async () => {
    setProblem(null);
    try {
      if (figure) await downloadPng(figure, title, Math.max(640, box.current?.clientWidth ?? 800), height);
    } catch {
      setProblem("The image could not be created. The CSV download still works.");
    }
  };

  return (
    <figure className={inline ? "" : "depth rounded-xl border border-border bg-white p-3"}>
      <ChartToolbar
        title={title}
        kind={current}
        compact={inline}
        onPng={exportPng}
        onCsv={() => downloadCsv(answer.columns, answer.rows, title)}
      />
      {problem && <p role="alert" className="mb-2 text-xs text-rose-700">{problem}</p>}
      <div ref={box} className="chart-stage rounded-xl">
        {figure ? <PlotlyChart figure={figure} height={height} /> : <ChartTable columns={answer.columns} rows={answer.rows} height={height} />}
      </div>
      {onKind && <ChartAsk options={suitableKinds(ctx).filter((k) => k !== current).slice(0, 7)} onPick={onKind} />}
    </figure>
  );
}
