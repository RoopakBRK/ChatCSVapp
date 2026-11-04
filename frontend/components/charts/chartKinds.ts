import type { ChartType } from "@/lib/api";
import type { FigureContext } from "./figureContext";
import type { Figure } from "./plotly/loadPlotly";
import type { ChartTheme } from "./plotly/theme";
import {
  barFigure, boxFigure, funnelFigure, histogramFigure, lineFigure, pieFigure, radarFigure, scatterFigure, treemapFigure,
} from "./figures2d";

export type ChartKind =
  | "bar" | "line" | "pie" | "scatter" | "funnel" | "treemap" | "radar" | "histogram" | "box" | "table";

export const KIND_LABEL: Record<ChartKind, string> = {
  bar: "Bars",
  line: "Line",
  pie: "Donut",
  scatter: "Scatter",
  funnel: "Funnel",
  treemap: "Treemap",
  radar: "Radar",
  histogram: "Histogram",
  box: "Box plot",
  table: "Table",
};

const BUILDERS: Record<Exclude<ChartKind, "table">, (c: FigureContext, height: number, t: ChartTheme) => Figure> = {
  bar: barFigure,
  line: lineFigure,
  pie: pieFigure,
  scatter: scatterFigure,
  funnel: funnelFigure,
  treemap: treemapFigure,
  radar: radarFigure,
  histogram: histogramFigure,
  box: boxFigure,
};

export function buildFigure(kind: Exclude<ChartKind, "table">, c: FigureContext, height: number, t: ChartTheme): Figure {
  return BUILDERS[kind](c, height, t);
}

/** Only the views that make sense for this data, best first. */
export function suitableKinds(c: FigureContext): ChartKind[] {
  const n = c.y.length;
  // Parts of a whole only make sense for values that add up (totals, counts), never for averages.
  const positive = c.additive && c.y.every((v) => v > 0);
  const kinds: ChartKind[] = [];
  const add = (k: ChartKind, ok = true) => ok && !kinds.includes(k) && kinds.push(k);

  if (c.xKind === "category") {
    add("bar");
    add("line");
    add("pie", n >= 2 && n <= 12 && positive);
    add("treemap", n >= 3 && n <= 60 && positive);
    add("funnel", n >= 3 && n <= 15 && positive);
    add("radar", n >= 3 && n <= 12);
  } else if (c.xKind === "date") {
    add("line");
    add("bar");
    add("scatter");
  } else {
    add("scatter");
    add("line");
    add("bar", n <= 60);
  }
  add("histogram", n >= 8);
  add("box", n >= 8);
  add("table");
  return kinds;
}

/** The first view: the model's suggestion, if it suits the data. */
export function defaultKind(type: ChartType, c: FigureContext): ChartKind {
  const fits = suitableKinds(c);
  const wanted: ChartKind =
    type === "bar" || (type === "pie" && !fits.includes("pie")) ? "bar" : type === "pie" ? "pie" : type === "scatter" ? "scatter" : "line";
  return fits.includes(wanted) ? wanted : fits[0];
}
