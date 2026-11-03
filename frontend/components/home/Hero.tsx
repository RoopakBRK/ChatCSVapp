import Link from "next/link";

/** A small, purely decorative preview of the app: a question, an answer and isometric bars. */
function Preview() {
  const bars = [44, 68, 56, 86, 74];
  return (
    <div aria-hidden className="depth relative mx-auto w-full max-w-md rounded-3xl border border-border bg-panel/80 p-5 text-left backdrop-blur">
      <div className="btn-accent ml-auto w-fit rounded-2xl rounded-br-lg px-4 py-2 text-xs">Which month had the most sales?</div>
      <div className="mt-3 w-fit rounded-2xl rounded-bl-lg border border-border bg-card px-4 py-2 text-xs">October was the busiest month.</div>
      <div className="chart-stage mt-4 flex h-36 items-end justify-center gap-3 rounded-2xl px-4 pb-4">
        {bars.map((h, i) => (
          <div key={i} className="relative w-9" style={{ height: `${h}%` }}>
            <div className="absolute inset-0 rounded-t-lg bg-gradient-to-t from-chart-1 via-chart-3 to-accent" />
            <div className="absolute -right-2 top-1 h-full w-2 -skew-y-[35deg] rounded-tr-lg bg-foreground/20" />
            <div className="absolute -top-2 left-1 h-2 w-full -skew-x-[55deg] rounded-t-lg bg-accent/80" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 md:grid-cols-2 md:pt-24">
      <div className="text-center md:text-left">
        <p className="mb-4 inline-block rounded-full border border-accent/40 bg-panel/70 px-3 py-1 text-xs font-semibold text-accent-ink">
          Ask your spreadsheets anything
        </p>
        <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">
          <span className="text-gradient-accent">Chat with CSV Files</span>
        </h1>
        <p className="mt-5 text-lg text-muted">
          Upload your CSVs and ask questions in plain English. CSVChat cleans the data, shows you every change it made,
          and answers with a chart, the numbers and the SQL behind them.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
          <Link href="/chat" className="btn-accent rounded-full px-8 py-3.5 text-base font-semibold depth-2 transition-transform hover:scale-[1.03]">
            Chat with CSV
          </Link>
          <a href="#how" className="rounded-full border border-border bg-card px-6 py-3.5 text-base font-semibold depth hover:border-accent hover:bg-accent-soft">
            See how it works
          </a>
        </div>
      </div>
      <Preview />
    </section>
  );
}
