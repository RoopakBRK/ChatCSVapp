import type { Figure } from "./plotly/loadPlotly";
import { valueTicks, type FigureContext } from "./figureContext";
import { alpha, colorscale, hoverLabel, sweep, type ChartTheme } from "./plotly/theme";

const TRANSPARENT = "rgba(0,0,0,0)";

const axisTitle = (t: ChartTheme, text: string) => ({ text, font: { color: t.muted, size: 11, family: t.sans }, standoff: 10 });
/** Numbers (ticks) in Geist Mono, words in Geist. */
const tickFont = (t: ChartTheme) => ({ color: t.muted, family: t.mono, size: 10 });

/** Tooltip: the full x label in bold, then the formatted value. */
const hover = (c: FigureContext) => `<b>%{customdata}</b><br>${c.yTitle}: %{text}<extra></extra>`;

function xAxis(c: FigureContext, t: ChartTheme) {
  const base = { title: axisTitle(t, c.xTitle), showgrid: false, linecolor: t.grid, automargin: true, tickfont: tickFont(t) };
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
    gridcolor: t.grid,
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
    font: { family: t.sans, size: 11, color: t.text },
    hoverlabel: hoverLabel(t),
    modebar: { bgcolor: TRANSPARENT, color: t.muted, activecolor: t.accent },
    showlegend: false,
    ...extra,
  };
}

function layout(c: FigureContext, t: ChartTheme, height: number, extra: Record<string, unknown> = {}) {
  return base(t, height, { margin: { l: 64, r: 18, t: 12, b: 56 }, xaxis: xAxis(c, t), yaxis: yAxis(c, t), ...extra });
}

/** Bars in the first chart colour, with a faint offset shadow behind them for depth. */
export function barFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const main = {
    type: "bar",
    x: c.x,
    y: c.y,
    customdata: c.full,
    text: c.yText,
    textposition: "none",
    hovertemplate: hover(c),
    marker: { color: sweep([t.chart[0], t.chart[4]], c.y.length), line: { width: 0 } },
  };
  const shadow = c.xKind === "category"
    ? [{ type: "bar", x: c.x, y: c.y, offset: -0.26, width: 0.6, marker: { color: alpha(t.text, t.dark ? 0.06 : 0.08) }, hoverinfo: "skip" }]
    : [];
  const placed = c.xKind === "category" ? { ...main, offset: -0.32, width: 0.6 } : main;
  return { data: [...shadow, placed], layout: layout(c, t, height, { barmode: "overlay", barcornerradius: 6, bargap: 0.3 }) };
}

/** A smooth line over a gradient-filled area, with a soft glow line underneath. */
export function lineFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const color = t.chart[0];
  const shadow = {
    type: "scatter", mode: "lines", x: c.x, y: c.y, hoverinfo: "skip",
    line: { shape: "spline", smoothing: 0.8, width: 9, color: alpha(color, 0.16) },
  };
  const main = {
    type: "scatter",
    mode: c.y.length <= 40 ? "lines+markers" : "lines",
    x: c.x,
    y: c.y,
    customdata: c.full,
    text: c.yText,
    hovertemplate: hover(c),
    line: { shape: "spline", smoothing: 0.8, width: 2.5, color },
    marker: { size: 6, color: t.panel, line: { color, width: 2 } },
    fill: "tozeroy",
    fillcolor: alpha(color, 0.12),
    fillgradient: { type: "vertical", colorscale: [[0, alpha(color, 0.0)], [1, alpha(color, 0.32)]] },
  };
  return { data: [shadow, main], layout: layout(c, t, height) };
}

/** A donut with the largest slice pulled out a little and the total in the middle. */
export function pieFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
  const biggest = c.y.indexOf(Math.max(...c.y));
  const total = c.y.reduce((a, b) => a + b, 0);
  return {
    data: [{
      type: "pie",
      labels: c.labels,
      values: c.y,
      customdata: c.yText,
      hole: 0.58,
      sort: false,
      pull: c.y.map((_, i) => (i === biggest ? 0.06 : 0)),
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
        text: `<b>${c.fmt.yTick(total)}</b><br><span style="font-size:10px">total</span>`,
        showarrow: false,
        font: { size: 15, color: t.text, family: t.mono },
      }],
    }),
  };
}

/** Points sized and coloured by value. */
export function scatterFigure(c: FigureContext, height: number, t: ChartTheme): Figure {
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
        colorscale: colorscale([t.chart[4], t.chart[0], t.chart[1]]),
        opacity: 0.85,
        line: { color: t.panel, width: 1.5 },
      },
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
      marker: { color: sweep([t.chart[0], t.chart[2]], order.length) },
      connector: { fillcolor: alpha(t.chart[2], 0.1), line: { width: 0 } },
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
  const color = t.chart[3];
  return {
    data: [{
      type: "scatterpolar",
      r: [...c.y, c.y[0]],
      theta: [...c.labels, c.labels[0]],
      customdata: [...c.full, c.full[0]],
      text: [...c.yText, c.yText[0]],
      hovertemplate: hover(c),
      fill: "toself",
      fillcolor: alpha(color, 0.18),
      line: { color, width: 2.5 },
      marker: { color: t.chart[2], size: 6 },
    }],
    layout: base(t, height, {
      margin: { l: 48, r: 48, t: 28, b: 28 },
      polar: {
        bgcolor: TRANSPARENT,
        radialaxis: { tickvals: ticks.vals, ticktext: ticks.text, range: ticks.range, gridcolor: t.grid, linecolor: t.grid, angle: 90, tickfont: { ...tickFont(t), size: 9 } },
        angularaxis: { gridcolor: t.grid, linecolor: t.grid, tickfont: { color: t.muted } },
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
      marker: { color: t.chart[2], line: { color: t.panel, width: 1.5 } },
      hovertemplate: `%{x}<br>%{y} rows<extra></extra>`,
    }],
    layout: base(t, height, {
      margin: { l: 64, r: 18, t: 12, b: 56 },
      xaxis: { title: axisTitle(t, c.yTitle), tickprefix: c.money ? "$" : "", tickformat: "~s", showgrid: false, linecolor: t.grid, tickfont: tickFont(t) },
      yaxis: { title: axisTitle(t, "Number of rows"), gridcolor: t.grid, zeroline: false, tickfont: tickFont(t) },
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
      marker: { color: t.chart[1], size: 6, opacity: 0.75 },
      line: { color: t.chart[0], width: 2 },
      fillcolor: alpha(t.chart[0], 0.14),
    }],
    layout: layout(c, t, height, { xaxis: { showticklabels: false, showgrid: false }, yaxis: yAxis(c, t, false) }),
  };
}
