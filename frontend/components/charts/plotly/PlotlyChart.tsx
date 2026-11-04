"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIG } from "./theme";
import { loadPlotly, type Figure } from "./loadPlotly";

/** Draws a Plotly figure (fading in), follows its container's size, and frees it on unmount. */
export default function PlotlyChart({ figure, height }: { figure: Figure; height: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let alive = true;
    // The entrance animation is CSS (.chart-in on the wrapper): Plotly's own data transitions broke
    // on gradient-filled lines, leaving points stuck at zero.
    loadPlotly()
      .then((Plotly) => Plotly.react(node, figure.data, figure.layout, CONFIG))
      .then(() => alive && setState("ready"))
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [figure]);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      loadPlotly()
        .then((Plotly) => {
          if (node.isConnected && node.querySelector(".main-svg")) Plotly.Plots.resize(node);
        })
        .catch(() => {});
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      loadPlotly().then((Plotly) => Plotly.purge(node)).catch(() => {});
    };
  }, []);

  return (
    <div className="chart-in relative" style={{ height }}>
      <div ref={el} className="h-full w-full" />
      {state === "loading" && <div className="absolute inset-0 flex items-center justify-center text-ui text-muted">Drawing chart…</div>}
      {state === "error" && (
        <div role="alert" className="absolute inset-0 flex items-center justify-center text-ui text-error-ink">
          Couldn’t draw this chart. Switch to Table to see the data.
        </div>
      )}
    </div>
  );
}
