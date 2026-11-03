// plotly.js-dist-min ships without types. The parts we use are typed in components/charts/plotly/loadPlotly.ts.
declare module "plotly.js-dist-min" {
  const Plotly: unknown;
  export default Plotly;
}
