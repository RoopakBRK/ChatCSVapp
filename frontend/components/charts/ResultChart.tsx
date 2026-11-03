"use client";

import { useMemo, useRef, useState } from "react";
import type { ChatAnswer } from "@/lib/api";
import ChartFullscreen from "./ChartFullscreen";
import ChartTable from "./ChartTable";
import ChartToolbar from "./ChartToolbar";
import { buildFigure, defaultKind, suitableKinds, type ChartKind } from "./chartKinds";
import { downloadCsv, downloadPng } from "./exportChart";
import { buildContext } from "./figureContext";
import PlotlyChart from "./plotly/PlotlyChart";
import { useChartTheme } from "./plotly/theme";

type Props = {
  answer: ChatAnswer;
  /** The view to show; when missing, the model's suggestion. */
  kind?: ChartKind;
  onKind?: (kind: ChartKind) => void;
  variant?: "inline" | "card" | "fullscreen";
};

const HEIGHT = { inline: 300, card: 360, fullscreen: 560 };

/** One chart for one answer, with its view switch, full screen, and downloads. */
export default function ResultChart({ answer, kind, onKind, variant = "card" }: Props) {
  const ctx = useMemo(() => buildContext(answer), [answer]);
  const theme = useChartTheme(); // redraws in the new colours when light/dark changes
  const [ownKind, setOwnKind] = useState<ChartKind | null>(null); // used when no parent keeps the choice
  const [full, setFull] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const current: ChartKind | null = ctx && answer.chart ? (kind ?? ownKind ?? defaultKind(answer.chart.type, ctx)) : null;
  const height = HEIGHT[variant];
  const figure = useMemo(
    () => (ctx && current && current !== "table" ? buildFigure(current, ctx, height, theme) : null),
    [ctx, current, height, theme],
  );
  if (!ctx || !current || !answer.chart) return null;

  const pick = onKind ?? setOwnKind;
  const title = answer.chart.title;
  const exportPng = async () => {
    setProblem(null);
    try {
      if (figure) await downloadPng(figure, title, Math.max(640, box.current?.clientWidth ?? 800), height, theme);
    } catch {
      setProblem("The image could not be created. The CSV download still works.");
    }
  };

  return (
    <figure className={variant === "card" ? "card depth rounded-xl p-3" : ""}>
      <ChartToolbar
        title={title}
        kind={current}
        kinds={suitableKinds(ctx)}
        compact={variant === "inline"}
        fullscreen={variant === "fullscreen"}
        onKind={pick}
        onFullscreen={() => setFull(true)}
        onPng={exportPng}
        onCsv={() => downloadCsv(answer.columns, answer.rows, title)}
      />
      {problem && <p role="alert" className="mb-2 text-xs text-error-ink">{problem}</p>}
      <div ref={box} className="chart-stage rounded-xl">
        {figure ? <PlotlyChart figure={figure} height={height} /> : <ChartTable columns={answer.columns} rows={answer.rows} height={height} />}
      </div>
      {full && (
        <ChartFullscreen onClose={() => setFull(false)}>
          <ResultChart answer={answer} kind={current} onKind={pick} variant="fullscreen" />
        </ChartFullscreen>
      )}
    </figure>
  );
}
