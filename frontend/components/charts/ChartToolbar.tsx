"use client";

import { useState } from "react";
import { KIND_LABEL, type ChartKind } from "./chartKinds";

type Props = {
  title: string;
  kind: ChartKind;
  kinds: ChartKind[]; // every view that suits this data
  compact: boolean;
  fullscreen: boolean;
  onKind: (kind: ChartKind) => void;
  onFullscreen: () => void;
  onPng: () => void;
  onCsv: () => void;
};

const Icon = ({ d }: { d: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const action = "btn-ghost flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold";

/** Bar / line / table switch (other suitable types under "More"), fullscreen, PNG and CSV. */
export default function ChartToolbar({ title, kind, kinds, compact, fullscreen, onKind, onFullscreen, onPng, onCsv }: Props) {
  const [more, setMore] = useState(false);
  // The three main views always sit in the switch; the suggested type joins them if it's something else.
  const main = (["bar", "line", "table"] as ChartKind[]).filter((k) => kinds.includes(k));
  const primary = kinds.includes(kind) && !main.includes(kind) ? [kind, ...main] : main;
  const extra = kinds.filter((k) => !primary.includes(k));

  return (
    <div className="mb-2 space-y-2">
      <p className={`font-display truncate leading-tight ${compact ? "text-lg" : "text-2xl"}`}>{title}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div role="group" aria-label="Chart type" className="flex rounded-full border border-border bg-panel/60 p-0.5">
            {primary.map((k) => (
              <button
                key={k}
                onClick={() => onKind(k)}
                aria-pressed={kind === k}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${kind === k ? "bg-accent text-on-accent" : "text-muted hover:text-foreground"}`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          {extra.length > 0 && (
            <div className="relative" onKeyDown={(e) => e.key === "Escape" && more && (e.stopPropagation(), setMore(false))}>
              <button onClick={() => setMore(!more)} aria-expanded={more} aria-haspopup="menu" className={action}>
                {extra.includes(kind) ? KIND_LABEL[kind] : "More"} <Icon d="M6 9l6 6 6-6" />
              </button>
              {more && (
                <>
                  <button aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setMore(false)} />
                  <div role="menu" className="glass depth-2 absolute left-0 top-9 z-40 min-w-36 rounded-xl p-1">
                    {extra.map((k) => (
                      <button
                        key={k}
                        role="menuitemradio"
                        aria-checked={kind === k}
                        onClick={() => {
                          onKind(k);
                          setMore(false);
                        }}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs ${kind === k ? "bg-accent-soft font-semibold" : "hover:bg-hover"}`}
                      >
                        {KIND_LABEL[k]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          {!fullscreen && (
            <button onClick={onFullscreen} aria-label="Show the chart full screen" title="Full screen" className={action}>
              <Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </button>
          )}
          <button onClick={onPng} disabled={kind === "table"} aria-label="Download chart as PNG" title={kind === "table" ? "Pick a chart to download an image" : "Download PNG"} className={action}>
            <Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" /> PNG
          </button>
          <button onClick={onCsv} aria-label="Download data as CSV" title="Download CSV" className={action}>
            <Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" /> CSV
          </button>
        </div>
      </div>
    </div>
  );
}
