export const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
export const INK = "#334155";
export const MUTED = "#64748b";
export const GRID = "rgba(129, 140, 248, 0.22)";

/** Sky -> indigo -> pink, the app's brand sweep. */
export const COLORSCALE: [number, string][] = [
  [0, "#38bdf8"],
  [0.5, "#6366f1"],
  [1, "#ec4899"],
];
export const PALETTE = ["#6366f1", "#ec4899", "#0ea5e9", "#d946ef", "#14b8a6", "#f59e0b", "#8b5cf6", "#f43f5e"];

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** A colour along the brand sweep, t from 0 to 1. */
export function ramp(t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const i = x <= 0.5 ? 0 : 1;
  const [a, b] = [hex(COLORSCALE[i][1]), hex(COLORSCALE[i + 1][1])];
  const f = (x - COLORSCALE[i][0]) / (COLORSCALE[i + 1][0] - COLORSCALE[i][0]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}

export const rampColors = (n: number) => Array.from({ length: n }, (_, i) => ramp(n === 1 ? 0.5 : i / (n - 1)));

export const HOVERLABEL = {
  bgcolor: "#ffffff",
  bordercolor: "rgba(99,102,241,0.35)",
  font: { family: FONT, color: "#1e1b4b", size: 12 },
};

/** Zoom and pan stay available; the mode bar only shows on hover and has no Plotly logo. */
export const CONFIG = {
  displaylogo: false,
  responsive: true,
  displayModeBar: "hover",
  modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "toImage", "sendDataToCloud"],
};
