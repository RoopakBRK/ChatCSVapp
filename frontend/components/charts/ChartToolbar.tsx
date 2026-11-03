import { KIND_LABEL, type ChartKind } from "./chartKinds";

type Props = { title: string; kind: ChartKind; compact: boolean; onPng: () => void; onCsv: () => void };

const download = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />
  </svg>
);

const action =
  "flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold transition-colors hover:border-pink-300 hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-40";

/** Chart title, which view is showing, and the PNG / CSV downloads. */
export default function ChartToolbar({ title, kind, compact, onPng, onCsv }: Props) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className={`truncate font-semibold ${compact ? "text-xs text-muted" : "text-sm"}`}>{title}</p>
        <p className="text-[11px] text-muted">{KIND_LABEL[kind]}</p>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={onPng}
          disabled={kind === "table"}
          title={kind === "table" ? "Pick a chart to download an image" : "Download the chart as a PNG image"}
          aria-label="Download chart as PNG"
          className={action}
        >
          {download} PNG
        </button>
        <button onClick={onCsv} title="Download the data as a CSV file" aria-label="Download data as CSV" className={action}>
          {download} CSV
        </button>
      </div>
    </div>
  );
}
