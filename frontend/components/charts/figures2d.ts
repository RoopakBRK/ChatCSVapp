import type { Figure } from "./plotly/loadPlotly";
import { valueTicks, type FigureContext } from "./figureContext";
import { FONT, GRID, HOVERLABEL, INK, MUTED, PALETTE, COLORSCALE, rampColors } from "./plotly/theme";

const TRANSPARENT = "rgba(0,0,0,0)";
const axisTitle = (text: string) => ({ text, font: { color: MUTED, size: 11 }, standoff: 10 });
const DATE_TICK = { year: "%Y", month: "%b %Y", day: "%b %-d", time: "%b %-d %H:%M" } as const;
const DATE_HOVER = { year: "%Y", month: "%B %Y", day: "%b %-d, %Y", time: "%b %-d, %Y %H:%M" } as const;

/** Tooltip: the full x label in bold, then the formatted value. */
const hover = (c: FigureContext) => `<b>%{customdata}</b><br>${c.yTitle}: %{text}<extra></extra>`;

function xAxis(c: FigureContext) {
  const base = { title: axisTitle(c.xTitle), showgrid: false, linecolor: GRID, automargin: true, tickfont: { color: INK } };
  if (c.xKind === "date" && c.dateAxis) {
    const g = c.dateAxis.granularity;
    const tick = g === "day" && c.dateAxis.multiYear ? "%b %-d, %Y" : DATE_TICK[g];
    return { ...base, type: "date", tickformat: tick, hoverformat: DATE_HOVER[g] };
  }
  if (c.xKind === "category") return { ...base, type: "category", tickvals: c.x, ticktext: c.labels };
  return base;
}

function yAxis(c: FigureContext, fromZero = true) {
  const t = valueTicks(c, fromZero);
  return {
    title: axisTitle(c.yTitle),
    gridcolor: GRID,
    zeroline: false,
    automargin: true,
    tickvals: t.vals,
    ticktext: t.text,
    range: t.range,
    tickfont: { color: INK },
  };
}

function layout(c: FigureContext, height: number, extra: Record<string, unknown> = {}) {
  return {
    height,
    autosize: true,
    margin: { l: 64, r: 18, t: 12, b: 56 },
    paper_bgcolor: TRANSPARENT,
    plot_bgcolor: TRANSPARENT,
    font: { family: FONT, size: 11, color: INK },
    hoverlabel: HOVERLABEL,
    showlegend: false,
    xaxis: xAxis(c),
    yaxis: yAxis(c),
    ...extra,
  };
}

/** Bars coloured along the brand sweep, with a soft offset shadow behind them for depth. */
export function barFigure(c: FigureContext, height: number): Figure {
  const main = {
    type: "bar",
    x: c.x,
    y: c.y,
    customdata: c.full,
    text: c.yText,
    textposition: "none",
    hovertemplate: hover(c),
    marker: { color: rampColors(c.y.length), line: { width: 0 } },
  };
  const shadow = c.xKind === "category"
    ? [{ type: "bar", x: c.x, y: c.y, offset: -0.26, width: 0.6, marker: { color: "rgba(30,27,75,0.10)" }, hoverinfo: "skip" }]
    : [];
  const placed = c.xKind === "category" ? { ...main, offset: -0.32, width: 0.6 } : main;
  return { data: [...shadow, placed], layout: layout(c, height, { barmode: "overlay", barcornerradius: 6, bargap: 0.3 }) };
}

/** A smooth line over a gradient-filled area, with a blurred shadow line underneath. */
export function lineFigure(c: FigureContext, height: number): Figure {
  const shadow = {
    type: "scatter", mode: "lines", x: c.x, y: c.y, hoverinfo: "skip",
    line: { shape: "spline", smoothing: 0.8, width: 9, color: "rgba(99,102,241,0.12)" },
  };
  const main = {
    type: "scatter",
    mode: c.y.length <= 40 ? "lines+markers" : "lines",
    x: c.x,
    y: c.y,
    customdata: c.full,
    text: c.yText,
    hovertemplate: hover(c),
    line: { shape: "spline", smoothing: 0.8, width: 3, color: "#ec4899" },
    marker: { size: 7, color: "#ffffff", line: { color: "#ec4899", width: 2 } },
    fill: "tozeroy",
    fillcolor: "rgba(236,72,153,0.12)",
    fillgradient: { type: "vertical", colorscale: [[0, "rgba(56,189,248,0.04)"], [1, "rgba(236,72,153,0.30)"]] },
  };
  return { data: [shadow, main], layout: layout(c, height) };
}

/** A donut with the largest slice pulled out a little and the total in the middle. */
export function pieFigure(c: FigureContext, height: number): Figure {
  const biggest = c.y.indexOf(Math.max(...c.y));
  const total = c.y.reduce((a, b) => a + b, 0);
  return {
    data: [{
      type: "pie",
      labels: c.labels,
      values: c.y,
      customdata: c.yText,
      hole: 0.56,
      sort: false,
      pull: c.y.map((_, i) => (i === biggest ? 0.06 : 0)),
      marker: { colors: PALETTE, line: { color: "#ffffff", width: 2 } },
      texttemplate: "%{label}<br>%{percent}",
      textposition: "outside",
      automargin: true,
      hovertemplate: `<b>%{label}</b><br>${c.yTitle}: %{customdata}<br>%{percent}<extra></extra>`,
    }],
    layout: {
      height, autosize: true, margin: { l: 24, r: 24, t: 24, b: 24 }, paper_bgcolor: TRANSPARENT,
      font: { family: FONT, size: 11, color: INK }, hoverlabel: HOVERLABEL, showlegend: false,
      annotations: [{ text: `<b>${c.fmt.yTick(total)}</b><br><span style="font-size:10px">total</span>`, showarrow: false, font: { size: 15, color: INK } }],
    },
  };
}

/** Points sized and coloured by value. */
export function scatterFigure(c: FigureContext, height: number): Figure {
  const max = Math.max(...c.y.map(Math.abs)) || 1;
  return {
    data: [{
      type: "scatter",
      mode: "markers",
      x: c.x,
      y: c.y,
      customdata: c.full,
      text: c.yText,
      hovertemplate: hover(c),
      marker: {
        size: c.y.map((v) => 8 + 18 * (Math.abs(v) / max)),
        color: c.y,
        colorscale: COLORSCALE,
        opacity: 0.85,
        line: { color: "#ffffff", width: 1.5 },
      },
    }],
    layout: layout(c, height, { yaxis: yAxis(c, false) }),
  };
}

/** Largest first, narrowing down: good for stages or rankings. */
export function funnelFigure(c: FigureContext, height: number): Figure {
  const order = c.y.map((_, i) => i).sort((a, b) => c.y[b] - c.y[a]);
  return {
    data: [{
      type: "funnel",
      y: order.map((i) => c.labels[i]),
      x: order.map((i) => c.y[i]),
      customdata: order.map((i) => c.yText[i]),
      texttemplate: "%{customdata}  ·  %{percentInitial:.0%}",
      textposition: "inside",
      textfont: { color: "#ffffff" },
      hovertemplate: `<b>%{y}</b><br>${c.yTitle}: %{customdata}<extra></extra>`,
      marker: { color: rampColors(order.length) },
      connector: { fillcolor: "rgba(99,102,241,0.08)", line: { width: 0 } },
    }],
    layout: {
      height, autosize: true, margin: { l: 16, r: 16, t: 12, b: 12 }, paper_bgcolor: TRANSPARENT, plot_bgcolor: TRANSPARENT,
      font: { family: FONT, size: 11, color: INK }, hoverlabel: HOVERLABEL, showlegend: false,
      yaxis: { automargin: true }, xaxis: { visible: false },
    },
  };
}

/** Each category as a block sized by its value. */
export function treemapFigure(c: FigureContext, height: number): Figure {
  return {
    data: [{
      type: "treemap",
      ids: c.labels.map((_, i) => `item-${i}`),
      labels: c.labels,
      parents: c.labels.map(() => ""),
      values: c.y,
      customdata: c.yText,
      texttemplate: "<b>%{label}</b><br>%{customdata}",
      hovertemplate: `<b>%{label}</b><br>${c.yTitle}: %{customdata}<br>%{percentRoot:.1%} of the total<extra></extra>`,
      marker: { colors: rampColors(c.y.length), line: { color: "#ffffff", width: 2 }, cornerradius: 6 },
      textfont: { color: "#ffffff" },
      tiling: { pad: 2 },
    }],
    layout: {
      height, autosize: true, margin: { l: 4, r: 4, t: 4, b: 4 }, paper_bgcolor: TRANSPARENT,
      font: { family: FONT, size: 12, color: INK }, hoverlabel: HOVERLABEL,
    },
  };
}

/** Categories around a circle; the shape shows which stand out. */
export function radarFigure(c: FigureContext, height: number): Figure {
  const t = valueTicks(c);
  return {
    data: [{
      type: "scatterpolar",
      r: [...c.y, c.y[0]],
      theta: [...c.labels, c.labels[0]],
      customdata: [...c.full, c.full[0]],
      text: [...c.yText, c.yText[0]],
      hovertemplate: hover(c),
      fill: "toself",
      fillcolor: "rgba(236,72,153,0.18)",
      line: { color: "#ec4899", width: 2.5 },
      marker: { color: "#6366f1", size: 6 },
    }],
    layout: {
      height, autosize: true, margin: { l: 48, r: 48, t: 28, b: 28 }, paper_bgcolor: TRANSPARENT,
      font: { family: FONT, size: 11, color: INK }, hoverlabel: HOVERLABEL, showlegend: false,
      polar: {
        bgcolor: "rgba(224,231,255,0.25)",
        radialaxis: { tickvals: t.vals, ticktext: t.text, range: t.range, gridcolor: GRID, linecolor: GRID, angle: 90, tickfont: { size: 9 } },
        angularaxis: { gridcolor: GRID, linecolor: GRID },
      },
    },
  };
}

/** How the values are spread out: how many rows fall in each range. */
export function histogramFigure(c: FigureContext, height: number): Figure {
  const bins = Math.min(24, Math.max(5, Math.ceil(Math.sqrt(c.y.length))));
  return {
    data: [{
      type: "histogram",
      x: c.y,
      nbinsx: bins,
      marker: { color: "#818cf8", line: { color: "#ffffff", width: 1.5 } },
      hovertemplate: `%{x}<br>%{y} rows<extra></extra>`,
    }],
    layout: {
      ...layout(c, height),
      xaxis: { title: axisTitle(c.yTitle), tickprefix: c.money ? "$" : "", tickformat: "~s", showgrid: false, linecolor: GRID },
      yaxis: { title: axisTitle("Number of rows"), gridcolor: GRID, zeroline: false },
      barcornerradius: 4,
      bargap: 0.06,
    },
  };
}

/** Median, quartiles and outliers of the values; each point is a row. */
export function boxFigure(c: FigureContext, height: number): Figure {
  return {
    data: [{
      type: "box",
      y: c.y,
      name: c.yTitle,
      customdata: c.full,
      text: c.yText,
      boxpoints: c.y.length <= 80 ? "all" : "outliers",
      jitter: 0.45,
      pointpos: 0,
      boxmean: true,
      hovertemplate: `<b>%{customdata}</b><br>${c.yTitle}: %{text}<extra></extra>`,
      marker: { color: "#ec4899", size: 6, opacity: 0.7 },
      line: { color: "#6366f1", width: 2 },
      fillcolor: "rgba(99,102,241,0.14)",
    }],
    layout: { ...layout(c, height), xaxis: { showticklabels: false, showgrid: false }, yaxis: yAxis(c, false) },
  };
}
