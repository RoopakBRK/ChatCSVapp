import type { CellValue } from "@/lib/api";
import { loadPlotly, type Figure } from "./plotly/loadPlotly";

/** "Top 5 categories by revenue" -> "top-5-categories-by-revenue" */
export function fileSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "chart";
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvField(v: CellValue): string {
  if (v === null) return "";
  let s = String(v);
  // A text cell that starts with = + - @ would run as a formula when opened in Excel or Sheets.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The raw values (not the formatted ones), so the file is usable in a spreadsheet. */
export function csvText(columns: string[], rows: CellValue[][]): string {
  return [columns.map(csvField), ...rows.map((r) => r.map(csvField))].map((r) => r.join(",")).join("\r\n");
}

export function downloadCsv(columns: string[], rows: CellValue[][], title: string) {
  // The byte-order mark makes Excel read accented characters correctly.
  save(new Blob(["﻿", csvText(columns, rows)], { type: "text/csv;charset=utf-8" }), `${fileSlug(title)}.csv`);
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Renders the figure again, off screen, with its title on a white background, and saves it as a PNG
 * at twice the size (sharp when zoomed). Works for the 3D charts too.
 */
export async function downloadPng(figure: Figure, title: string, width: number, height: number) {
  const Plotly = await loadPlotly();
  const total = height + 56;
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${total}px;`;
  document.body.appendChild(host);
  try {
    const margin = { ...((figure.layout.margin as object) ?? {}), t: 56 };
    const layout = {
      ...figure.layout,
      width,
      height: total,
      margin,
      paper_bgcolor: "#ffffff",
      title: { text: `<b>${escapeHtml(title)}</b>`, x: 0.02, xanchor: "left", y: 0.98, yanchor: "top", font: { size: 16, color: "#1f2347" } },
    };
    await Plotly.newPlot(host, figure.data, layout, { staticPlot: true });
    const url = await Plotly.toImage(host, { format: "png", width, height: total, scale: 2 });
    save(await (await fetch(url)).blob(), `${fileSlug(title)}.png`);
  } finally {
    Plotly.purge(host);
    host.remove();
  }
}
