"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatAnswer } from "@/lib/api";
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
  onKind: (kind: ChartKind) => void;
};

/** Each chart is this tall in the results thread (fullscreen uses the whole screen). */
export const CHART_HEIGHT = 320;

/** A chart in the results thread: as wide as the panel, 320px tall, controls underneath. */
export default function ResultChart({ answer, kind, onKind }: Props) {
  const ctx = useMemo(() => buildContext(answer), [answer]);
  const theme = useChartTheme(); // redraws in the new colours when light/dark changes
  const block = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: CHART_HEIGHT });
  const [fullscreen, setFullscreen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // The chart follows the space it has (panel resizes, window resizes, fullscreen).
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.height - height) < 4 && Math.abs(s.width - width) < 4 ? s : { width: Math.round(width), height: Math.round(height) }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === block.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const current: ChartKind | null = ctx && answer.chart ? (kind ?? defaultKind(answer.chart.type, ctx)) : null;
  const height = Math.max(200, size.height);
  const figure = useMemo(
    () => (ctx && current && current !== "table" && size.height > 0 ? buildFigure(current, ctx, height, theme) : null),
    [ctx, current, height, size.height, theme],
  );
  if (!ctx || !current || !answer.chart) return null;

  const title = answer.chart.title;
  const exportPng = async () => {
    setProblem(null);
    try {
      if (figure) await downloadPng(figure, title, Math.max(640, size.width), height, theme);
    } catch {
      setProblem("Couldn't create the image.");
    }
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else block.current?.requestFullscreen().catch(() => {});
  };

  return (
    <div ref={block} className="chart-block light-surface flex flex-col rounded-lg p-3">
      <div ref={stage} className={fullscreen ? "min-h-0 flex-1" : "h-80"}>
        {current === "table" ? (
          <ChartTable columns={answer.columns} rows={answer.rows} height={height} />
        ) : figure ? (
          <PlotlyChart figure={figure} height={height} />
        ) : null}
      </div>
      {problem && <p role="alert" className="pt-2 text-ui text-error-ink">{problem}</p>}
      <ChartToolbar
        kind={current}
        kinds={suitableKinds(ctx)}
        fullscreen={fullscreen}
        onKind={onKind}
        onFullscreen={toggleFullscreen}
        onPng={exportPng}
        onCsv={() => downloadCsv(answer.columns, answer.rows, title)}
      />
    </div>
  );
}
