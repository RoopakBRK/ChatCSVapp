import type { Figure } from "./plotly/loadPlotly";
import { valueTicks, type FigureContext } from "./figureContext";
import { alpha, hoverLabel, sweep, type ChartTheme } from "./plotly/theme";

const TRANSPARENT = "rgba(0,0,0,0)";

const axisTitle = (t: ChartTheme, text: string) => ({ text, font: { color: t.muted, size: 12, family: t.sans }, standoff: 8 });
/** Numbers (ticks) in Geist Mono, words in Geist. */
const tickFont = (t: ChartTheme) => ({ color: t.muted, family: t.mono, size: 12 });
/** Light gridlines: just enough to read values across. */
const gridColor = (t: ChartTheme) => alpha(t.text, t.dark ? 0.08 : 0.06);
/** Charts with one series use only the accent colour. */
const one = (t: ChartTheme) => t.accent;

/** Tooltip: the full x label in bold, then the formatted value. */
const hover = (c: FigureContext) => `<b>%{customdata}</b><br>${c.yTitle}: %{text}<extra></extra>`;

function xAxis(c: FigureContext, t: ChartTheme) {
  const base = { title: axisTitle(t, c.xTitle), showgrid: false, linecolor: gridColor(t), automargin: true, tickfont: tickFont(t) };
  if (c.xKind === "date" && c.dateAxis) {
    // Our own lower-case labels ("nov 2024") at up to 8 evenly spaced points.
    const every = Math.max(1, Math.ceil(c.x.length / 8));
    const at = c.x.map((_, i) => i).filter((i) => i % every === 0);
    return { ...base, type: "date", tickvals: at.map((i) => c.x[i]), ticktext: at.map((i) => c.labels[i]) };
  }
  if (c.xKind === "category") return { ...base, type: "category", tickvals: c.x, ticktext: c.labels, tickfont: { ...tickFont(t), family: t.sans } };
  return base;
}

function yAxis(c: FigureContext, t: ChartTheme, fromZero = true) {
  const ticks = valueTicks(c, fromZero);
  return {
    title: axisTitle(t, c.yTitle),
    gridcolor: gridColor(t),
    zeroline: false,
    automargin: true,
    tickvals: ticks.vals,
    ticktext: ticks.text,
    range: ticks.range,
    tickfont: tickFont(t),
  };
}

function base(t: ChartTheme, height: number, extra: Record<string, unknown> = {}) {
  return {
    height,
    autosize: true,
    paper_bgcolor: TRANSPARENT,
    plot_bgcolor: TRANSPARENT,
    font: { family: t.sans, size: 12, color: t.text },
    hoverlabel: hoverLabel(t),
    showlegend: false,
    ...extra,
  };
}

function layout(c: FigureContext, t: ChartTheme, height: number, extra: Record<string, unknown> = {}) {
  return base(t, height, { margin: { l: 64, r: 18, t: 12, b: 56 }, xaxis: xAxis(c, t), yaxis: yAxis(c, t), ...extra });
}

/** Bars in the accent colour with slightly rounded tops. */
export function barFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const bars = {
    type: "bar",
    x: c.x,
    y: c.y,
    customdata: c.full,
    text: c.yText,
    textposition: "none",
    hovertemplate: hover(c),
    marker: { color: one(t), line: { width: 0 } },
  };
  return { data: [bars], layout: layout(c, t, height, { barcornerradius: 4, bargap: 0.3 }) };
}

/** A smooth accent line over a light fill. */
export function lineFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const color = one(t);
  const main = {
    type: "scatter",
    mode: c.y.length <= 40 ? "lines+markers" : "lines",
    x: c.x,
    y: c.y,
    customdata: c.full,
    text: c.yText,
    hovertemplate: hover(c),
    line: { shape: "spline", smoothing: 0.6, width: 2, color },
    marker: { size: 5, color },
    fill: "tozeroy",
    fillcolor: alpha(color, 0.1),
  };
  return { data: [main], layout: layout(c, t, height) };
}

/** A donut with the total in the middle (parts of a whole need one colour each). */
export function pieFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const total = c.y.reduce((a, b) => a + b, 0);
  return {
    data: [{
      type: "pie",
      labels: c.labels,
      values: c.y,
      customdata: c.yText,
      hole: 0.58,
      sort: false,
      marker: { colors: t.chart, line: { color: t.panel, width: 2 } },
      texttemplate: "%{label}<br>%{percent}",
      textposition: "outside",
      outsidetextfont: { color: t.muted, family: t.sans },
      automargin: true,
      hovertemplate: `<b>%{label}</b><br>${c.yTitle}: %{customdata}<br>%{percent}<extra></extra>`,
    }],
    layout: base(t, height, {
      margin: { l: 24, r: 24, t: 24, b: 24 },
      annotations: [{
        text: `<b>${c.fmt.yTick(total)}</b><br><span style="font-size:12px">total</span>`,
        showarrow: false,
        font: { size: 15, color: t.text, family: t.mono },
      }],
    }),
  };
}

/** Points in the accent colour. */
export function scatterFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  return {
    data: [{
      type: "scatter",
      mode: "markers",
      x: c.x,
      y: c.y,
      customdata: c.full,
      text: c.yText,
      hovertemplate: hover(c),
      marker: { size: 8, color: one(t), opacity: 0.8 },
    }],
    layout: layout(c, t, height, { yaxis: yAxis(c, t, false) }),
  };
}

/** Largest first, narrowing down: good for stages or rankings. */
export function funnelFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const order = c.y.map((_, i) => i).sort((a, b) => c.y[b] - c.y[a]);
  return {
    data: [{
      type: "funnel",
      y: order.map((i) => c.labels[i]),
      x: order.map((i) => c.y[i]),
      customdata: order.map((i) => c.yText[i]),
      texttemplate: "%{customdata}  ·  %{percentInitial:.0%}",
      textposition: "inside",
      textfont: { color: t.panel, family: t.mono },
      hovertemplate: `<b>%{y}</b><br>${c.yTitle}: %{customdata}<extra></extra>`,
      marker: { color: one(t) },
      connector: { fillcolor: alpha(one(t), 0.1), line: { width: 0 } },
    }],
    layout: base(t, height, { margin: { l: 16, r: 16, t: 12, b: 12 }, yaxis: { automargin: true, tickfont: { color: t.muted } }, xaxis: { visible: false } }),
  };
}

/** Each category as a block sized by its value. */
export function treemapFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
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
      marker: { colors: sweep(t.chart, c.y.length), line: { color: t.panel, width: 2 }, cornerradius: 6 },
      textfont: { color: t.panel, family: t.sans },
      tiling: { pad: 2 },
    }],
    layout: base(t, height, { margin: { l: 4, r: 4, t: 4, b: 4 } }),
  };
}

/** Categories around a circle; the shape shows which stand out. */
export function radarFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const ticks = valueTicks(c);
  const color = one(t);
  return {
    data: [{
      type: "scatterpolar",
      r: [...c.y, c.y[0]],
      theta: [...c.labels, c.labels[0]],
      customdata: [...c.full, c.full[0]],
      text: [...c.yText, c.yText[0]],
      hovertemplate: hover(c),
      fill: "toself",
      fillcolor: alpha(color, 0.12),
      line: { color, width: 2 },
      marker: { color, size: 5 },
    }],
    layout: base(t, height, {
      margin: { l: 48, r: 48, t: 28, b: 28 },
      polar: {
        bgcolor: TRANSPARENT,
        radialaxis: { tickvals: ticks.vals, ticktext: ticks.text, range: ticks.range, gridcolor: gridColor(t), linecolor: gridColor(t), angle: 90, tickfont: tickFont(t) },
        angularaxis: { gridcolor: gridColor(t), linecolor: gridColor(t), tickfont: { color: t.muted, size: 12 } },
      },
    }),
  };
}

/** How the values are spread out: how many rows fall in each range. */
export function histogramFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const bins = Math.min(24, Math.max(5, Math.ceil(Math.sqrt(c.y.length))));
  return {
    data: [{
      type: "histogram",
      x: c.y,
      nbinsx: bins,
      marker: { color: one(t), line: { color: t.panel, width: 1 } },
      hovertemplate: `%{x}<br>%{y} rows<extra></extra>`,
    }],
    layout: base(t, height, {
      margin: { l: 64, r: 18, t: 12, b: 56 },
      xaxis: { title: axisTitle(t, c.yTitle), tickprefix: c.money ? "$" : "", tickformat: "~s", showgrid: false, linecolor: gridColor(t), tickfont: tickFont(t) },
      yaxis: { title: axisTitle(t, "Rows"), gridcolor: gridColor(t), zeroline: false, tickfont: tickFont(t) },
      barcornerradius: 4,
      bargap: 0.06,
    }),
  };
}

/** Median, quartiles and outliers of the values; each point is a row. */
export function boxFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
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
      marker: { color: one(t), size: 5, opacity: 0.7 },
      line: { color: one(t), width: 2 },
      fillcolor: alpha(one(t), 0.12),
    }],
    layout: layout(c, t, height, { xaxis: { showticklabels: false, showgrid: false }, yaxis: yAxis(c, t, false) }),
  };
}
