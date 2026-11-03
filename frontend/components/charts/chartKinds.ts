import type { ChartType } from "@/lib/api";
import type { FigureContext } from "./figureContext";
import type { Figure } from "./plotly/loadPlotly";
import { area3dFigure, bar3dFigure } from "./figures3d";
import {
  barFigure, boxFigure, funnelFigure, histogramFigure, lineFigure, pieFigure, radarFigure, scatterFigure, treemapFigure,
} from "./figures2d";

export type ChartKind =
  | "bar3d" | "bar" | "line" | "area3d" | "pie" | "scatter" | "funnel" | "treemap" | "radar" | "histogram" | "box" | "table";

export const KIND_LABEL: Record<ChartKind, string> = {
  bar3d: "3D bars",
  bar: "Bars",
  line: "Line",
  area3d: "3D area",
  pie: "Donut",
  scatter: "Scatter",
  funnel: "Funnel",
  treemap: "Treemap",
  radar: "Radar",
  histogram: "Histogram",
  box: "Box plot",
  table: "Table",
};

const BUILDERS: Record<Exclude<ChartKind, "table">, (c: FigureContext, height: number) => Figure> = {
  bar3d: bar3dFigure,
  bar: barFigure,
  line: lineFigure,
  area3d: area3dFigure,
  pie: pieFigure,
  scatter: scatterFigure,
  funnel: funnelFigure,
  treemap: treemapFigure,
  radar: radarFigure,
  histogram: histogramFigure,
  box: boxFigure,
};

export function buildFigure(kind: Exclude<ChartKind, "table">, c: FigureContext, height: number): Figure {
  return BUILDERS[kind](c, height);
}

/** Only the views that make sense for this data, best first. */
export function suitableKinds(c: FigureContext): ChartKind[] {
  const n = c.y.length;
  // Parts of a whole only make sense for values that add up (totals, counts), never for averages.
  const positive = c.additive && c.y.every((v) => v > 0);
  const kinds: ChartKind[] = [];
  const add = (k: ChartKind, ok = true) => ok && !kinds.includes(k) && kinds.push(k);

  if (c.xKind === "category") {
    add("bar3d", n <= 20);
    add("bar");
    add("pie", n >= 2 && n <= 12 && positive);
    add("treemap", n >= 3 && n <= 60 && positive);
    add("funnel", n >= 3 && n <= 15 && positive);
    add("radar", n >= 3 && n <= 12);
  } else if (c.xKind === "date") {
    add("line");
    add("area3d", n >= 2 && n <= 60);
    add("bar");
    add("bar3d", n <= 20);
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

/** The first view: the model's suggestion, drawn with a bit of depth where that still reads well. */
export function defaultKind(type: ChartType, c: FigureContext): ChartKind {
  const fits = suitableKinds(c);
  const wanted: ChartKind =
    type === "bar" || (type === "pie" && !fits.includes("pie"))
      ? (fits.includes("bar3d") ? "bar3d" : "bar")
      : type === "pie" ? "pie" : type === "scatter" ? "scatter" : "line";
  return fits.includes(wanted) ? wanted : fits[0];
}
