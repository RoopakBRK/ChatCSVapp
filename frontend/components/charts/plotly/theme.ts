"use client";

import { useMemo } from "react";
import { useTheme } from "@/lib/theme";

/** The CSS design tokens, resolved to real colour strings, because Plotly can't read CSS variables. */
export type ChartTheme = {
  dark: boolean;
  text: string;
  muted: string;
  grid: string;
  card: string;
  panel: string;
  accent: string;
  chart: string[]; // --chart-1 .. --chart-5
  sans: string;
  mono: string;
  serif: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipBorder: string;
};

const FALLBACK: ChartTheme = {
  dark: false, text: "#1b2133", muted: "#626a7d", grid: "rgba(27,33,51,0.1)", card: "#fdfbf7", panel: "#ffffff",
  accent: "#b7791f", chart: ["#0f766e", "#b7791f", "#6366f1", "#e11d48", "#0284c7"], sans: "system-ui, sans-serif", mono: "ui-monospace, monospace", serif: "Georgia, serif",
  tooltipBg: "rgba(18,26,46,0.94)", tooltipText: "#e8ecf5", tooltipBorder: "rgba(255,255,255,0.12)",
};

export function readChartTheme(dark: boolean): ChartTheme {
  if (typeof window === "undefined") return FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    dark,
    text: v("--text", FALLBACK.text),
    muted: v("--muted", FALLBACK.muted),
    grid: v("--border", FALLBACK.grid),
    card: v("--card", FALLBACK.card),
    panel: v("--panel", FALLBACK.panel),
    accent: v("--accent", FALLBACK.accent),
    chart: [1, 2, 3, 4, 5].map((i) => v(`--chart-${i}`, FALLBACK.chart[i - 1])),
    sans: `${v("--font-geist-sans", "")}, system-ui, sans-serif`.replace(/^, /, ""),
    mono: `${v("--font-geist-mono", "")}, ui-monospace, monospace`.replace(/^, /, ""),
    serif: `${v("--font-instrument-serif", "")}, Georgia, serif`.replace(/^, /, ""),
    tooltipBg: v("--tooltip-bg", FALLBACK.tooltipBg),
    tooltipText: v("--tooltip-text", FALLBACK.tooltipText),
    tooltipBorder: v("--tooltip-border", FALLBACK.tooltipBorder),
  };
}

/** The chart theme for the current light/dark mode; charts redraw when it changes. */
export function useChartTheme(): ChartTheme {
  const theme = useTheme();
  return useMemo(() => readChartTheme(theme === "dark"), [theme]);
}

/* ---------- colour helpers ---------- */

function rgb(color: string): [number, number, number] | null {
  const hex = color.match(/^#([0-9a-f]{6})/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
  const fn = color.match(/rgba?\(([^)]+)\)/);
  if (fn) return fn[1].split(",").slice(0, 3).map((x) => Number(x.trim())) as [number, number, number];
  return null;
}

/** The colour with the given opacity. */
export function alpha(color: string, a: number): string {
  const c = rgb(color);
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : color;
}

/** n colours spread evenly along a sweep of colours (for ordered categories). */
export function sweep(colors: string[], n: number): string[] {
  const stops = colors.map(rgb).filter(Boolean) as [number, number, number][];
  if (stops.length < 2) return Array(n).fill(colors[0]);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const pos = t * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(pos));
    const f = pos - k;
    return `rgb(${stops[k].map((v, j) => Math.round(v + (stops[k + 1][j] - v) * f)).join(",")})`;
  });
}

/** A Plotly colorscale through the given colours. */
export const colorscale = (colors: string[]): [number, string][] =>
  colors.map((c, i) => [colors.length === 1 ? 0 : i / (colors.length - 1), c]);

/** Tooltips: a dark glass card (#121a2e) in both themes. */
export function hoverLabel(t: ChartTheme) {
  return { bgcolor: t.tooltipBg, bordercolor: t.tooltipBorder, font: { family: t.sans, color: t.tooltipText, size: 12 }, align: "left" };
}

/** Zoom and pan stay available; the mode bar only shows on hover and has no Plotly logo. */
export const CONFIG = {
  displaylogo: false,
  responsive: true,
  displayModeBar: "hover",
  modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "toImage", "sendDataToCloud"],
};
