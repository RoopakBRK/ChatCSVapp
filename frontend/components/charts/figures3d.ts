import type { Figure } from "./plotly/loadPlotly";
import { valueTicks, type FigureContext } from "./figureContext";
import { COLORSCALE, FONT, GRID, HOVERLABEL, INK, MUTED } from "./plotly/theme";

/**
 * Isometric 3D views. Bars and areas are solid shapes (mesh3d) seen through an orthographic camera,
 * so nothing shrinks with distance and values stay comparable. Colour runs from blue at the base to
 * pink at the top. Drag to rotate, scroll to zoom.
 */

const DEPTH = 0.32; // half the thickness of each shape, in category units
const short = (s: string, n = 12) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function scene(c: FigureContext, height: number) {
  const t = valueTicks(c);
  const n = c.y.length;
  const every = Math.ceil(n / 10); // at most about ten labels along the bottom edge, so they never pile up
  const shown = c.labels.map((_, i) => i).filter((i) => i % every === 0);
  const axis = { gridcolor: GRID, linecolor: GRID, zeroline: false, showbackground: true, tickfont: { size: 10, color: INK } };
  return {
    height,
    autosize: true,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: "rgba(0,0,0,0)",
    font: { family: FONT, size: 11, color: INK },
    hoverlabel: HOVERLABEL,
    showlegend: false,
    scene: {
      // A classic isometric angle: equal parts right, front and above.
      camera: { projection: { type: "orthographic" }, eye: { x: 1.55, y: -1.55, z: 1.15 }, up: { x: 0, y: 0, z: 1 } },
      aspectmode: "manual",
      aspectratio: { x: Math.min(3.2, Math.max(1.8, n * 0.32)), y: 0.55, z: 1.05 },
      dragmode: "turntable",
      xaxis: {
        ...axis,
        title: { text: c.xTitle, font: { color: MUTED, size: 11 } },
        tickvals: shown,
        ticktext: shown.map((i) => short(c.labels[i])),
        range: [-0.7, n - 0.3],
        backgroundcolor: "rgba(224,231,255,0.35)",
      },
      yaxis: { ...axis, title: { text: "" }, showticklabels: false, showgrid: false, range: [-1, 1], backgroundcolor: "rgba(252,231,243,0.35)" },
      zaxis: {
        ...axis,
        title: { text: c.yTitle, font: { color: MUTED, size: 11 } },
        tickvals: t.vals,
        ticktext: t.text,
        range: t.range,
        backgroundcolor: "rgba(224,242,254,0.35)",
      },
    },
  };
}

// Mostly ambient light so the brand colours stay bright; a little diffuse light still shades each face differently.
const lighting = { ambient: 0.82, diffuse: 0.45, specular: 0.08, roughness: 0.7, fresnel: 0.05 };

/** One cuboid per category. */
export function bar3dFigure(c: FigureContext, height: number): Figure {
  const x: number[] = [], y: number[] = [], z: number[] = [], i: number[] = [], j: number[] = [], k: number[] = [];
  const hovertext: string[] = [];
  const faces = [[0, 1, 2], [0, 2, 3], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 2, 6], [1, 6, 5]];
  const w = 0.32;
  c.y.forEach((v, n) => {
    const base = x.length;
    for (const [dx, dy, top] of [[-w, -DEPTH, 0], [w, -DEPTH, 0], [w, DEPTH, 0], [-w, DEPTH, 0], [-w, -DEPTH, 1], [w, -DEPTH, 1], [w, DEPTH, 1], [-w, DEPTH, 1]]) {
      x.push(n + dx);
      y.push(dy);
      z.push(top ? v : 0);
      hovertext.push(`<b>${c.full[n]}</b><br>${c.yTitle}: ${c.yText[n]}`);
    }
    for (const [a, b, d] of faces) {
      i.push(base + a);
      j.push(base + b);
      k.push(base + d);
    }
  });
  const hi = Math.max(...c.y.map(Math.abs)) || 1;
  return {
    data: [
      {
        type: "mesh3d", x, y, z, i, j, k,
        intensity: z.map((v) => Math.abs(v) / hi), // blue at the base, pink at the top
        colorscale: COLORSCALE, cmin: 0, cmax: 1, showscale: false,
        flatshading: true, lighting, lightposition: { x: 1000, y: -3000, z: 2000 },
        hovertext, hoverinfo: "text",
      },
      {
        type: "scatter3d", mode: "text", hoverinfo: "skip",
        x: c.y.map((_, n) => n), y: c.y.map(() => -DEPTH), z: c.y.map((v) => v + hi * 0.06),
        text: c.y.map((v) => c.fmt.yTick(v)), textfont: { size: 10, color: INK },
      },
    ],
    layout: scene(c, height),
  };
}

/** The line extruded into a solid band, like a 3D area chart. */
export function area3dFigure(c: FigureContext, height: number): Figure {
  const x: number[] = [], y: number[] = [], z: number[] = [], i: number[] = [], j: number[] = [], k: number[] = [];
  const hovertext: string[] = [];
  // For each point: front-bottom, front-top, back-bottom, back-top.
  c.y.forEach((v, n) => {
    for (const [dy, top] of [[-DEPTH, 0], [-DEPTH, 1], [DEPTH, 0], [DEPTH, 1]]) {
      x.push(n);
      y.push(dy);
      z.push(top ? v : 0);
      hovertext.push(`<b>${c.full[n]}</b><br>${c.yTitle}: ${c.yText[n]}`);
    }
  });
  /** Two triangles covering the four corners a-b-c-d, in order around the edge. */
  const quad = (a: number, b: number, cc: number, d: number) => {
    i.push(a, a);
    j.push(b, cc);
    k.push(cc, d);
  };
  for (let n = 0; n < c.y.length - 1; n++) {
    const [fb, ft, bb, bt] = [0, 1, 2, 3].map((o) => n * 4 + o);
    const [nfb, nft, nbb, nbt] = [0, 1, 2, 3].map((o) => (n + 1) * 4 + o);
    quad(fb, nfb, nft, ft); // front wall
    quad(bb, nbb, nbt, bt); // back wall
    quad(ft, nft, nbt, bt); // top surface
  }
  const last = (c.y.length - 1) * 4;
  quad(0, 2, 3, 1); // start cap
  quad(last, last + 2, last + 3, last + 1); // end cap

  const hi = Math.max(...c.y.map(Math.abs)) || 1;
  return {
    data: [
      {
        type: "mesh3d", x, y, z, i, j, k,
        intensity: z.map((v) => Math.abs(v) / hi),
        colorscale: COLORSCALE, cmin: 0, cmax: 1, showscale: false,
        flatshading: true, lighting, lightposition: { x: 1000, y: -3000, z: 2000 },
        hovertext, hoverinfo: "text",
      },
      {
        type: "scatter3d", mode: "lines+markers", hoverinfo: "skip",
        x: c.y.map((_, n) => n), y: c.y.map(() => -DEPTH), z: c.y,
        line: { color: "#ec4899", width: 6 }, marker: { size: 3, color: "#ffffff", line: { color: "#ec4899", width: 1 } },
      },
    ],
    layout: scene(c, height),
  };
}
