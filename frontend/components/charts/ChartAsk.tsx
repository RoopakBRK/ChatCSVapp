import { KIND_LABEL, type ChartKind } from "./chartKinds";

/** Asks before drawing anything else: other chart types appear only when the user picks one. */
export default function ChartAsk({ options, onPick }: { options: ChartKind[]; onPick: (kind: ChartKind) => void }) {
  if (options.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-medium text-muted">Want to see this another way?</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((k) => (
          <button
            key={k}
            onClick={() => onPick(k)}
            className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50"
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
    </div>
  );
}
