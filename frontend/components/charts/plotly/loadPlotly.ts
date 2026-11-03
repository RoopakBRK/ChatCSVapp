/** A Plotly figure: traces plus layout. Kept loose on purpose; the builders in ../figures*.ts give it shape. */
export type Figure = { data: Record<string, unknown>[]; layout: Record<string, unknown> };

/** The slice of the Plotly API this app uses. */
export interface PlotlyApi {
  react(el: HTMLElement, data: Figure["data"], layout: Figure["layout"], config?: Record<string, unknown>): Promise<unknown>;
  newPlot(el: HTMLElement, data: Figure["data"], layout: Figure["layout"], config?: Record<string, unknown>): Promise<unknown>;
  purge(el: HTMLElement): void;
  toImage(el: HTMLElement, opts: { format: "png"; width: number; height: number; scale?: number }): Promise<string>;
  Plots: { resize(el: HTMLElement): unknown };
}

let loading: Promise<PlotlyApi> | null = null;

/** Plotly is large, so it is only downloaded the first time a chart is drawn, then reused. */
export function loadPlotly(): Promise<PlotlyApi> {
  loading ??= import("plotly.js-dist-min").then((m) => ((m as { default?: unknown }).default ?? m) as PlotlyApi);
  return loading;
}
