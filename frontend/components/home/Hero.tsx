import Link from "next/link";

/** A small, purely decorative preview of the app: a question, an answer and isometric bars. */
function Preview() {
  const bars = [44, 68, 56, 86, 74];
  return (
    <div aria-hidden className="depth relative mx-auto w-full max-w-md rounded-3xl border border-white/70 bg-white/80 p-5 text-left backdrop-blur">
      <div className="bg-gradient-brand ml-auto w-fit rounded-2xl rounded-br-md px-4 py-2 text-xs text-white">Which month had the most sales?</div>
      <div className="mt-3 w-fit rounded-2xl rounded-bl-md border border-border bg-white px-4 py-2 text-xs">October was the busiest month.</div>
      <div className="chart-stage mt-4 flex h-36 items-end justify-center gap-3 rounded-2xl px-4 pb-4">
        {bars.map((h, i) => (
          <div key={i} className="relative w-9" style={{ height: `${h}%` }}>
            <div className="absolute inset-0 rounded-t-md bg-gradient-to-t from-sky-400 via-indigo-500 to-pink-500" />
            <div className="absolute -right-2 top-1 h-full w-2 -skew-y-[35deg] rounded-tr-md bg-indigo-900/25" />
            <div className="absolute -top-2 left-1 h-2 w-full -skew-x-[55deg] rounded-t-md bg-pink-300/80" />
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
        <p className="mb-4 inline-block rounded-full border border-pink-200 bg-white/70 px-3 py-1 text-xs font-semibold text-pink-600">
          Ask your spreadsheets anything
        </p>
        <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">
          <span className="text-gradient-brand">Chat with CSV Files</span>
        </h1>
        <p className="mt-5 text-lg text-muted">
          Upload your CSVs and ask questions in plain English. CSVChat cleans the data, shows you every change it made,
          and answers with a chart, the numbers and the SQL behind them.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
          <Link href="/chat" className="bg-gradient-brand rounded-full px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-pink-200 transition-transform hover:scale-[1.03]">
            Chat with CSV
          </Link>
          <a href="#how" className="rounded-full border border-border bg-white px-6 py-3.5 text-base font-semibold shadow-sm hover:border-pink-300 hover:bg-pink-50">
            See how it works
          </a>
        </div>
      </div>
      <Preview />
    </section>
  );
}
