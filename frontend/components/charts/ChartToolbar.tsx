"use client";

import { useState } from "react";
import { KIND_LABEL, type ChartKind } from "./chartKinds";

type Props = {
  kind: ChartKind;
  kinds: ChartKind[]; // every view that suits this data
  fullscreen: boolean;
  onKind: (kind: ChartKind) => void;
  onFullscreen: () => void;
  onPng: () => void;
  onCsv: () => void;
};

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const icon = "flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground disabled:opacity-40";

/** Under the chart: chart type (Bars / Line / Table, others under More), fullscreen, PNG and CSV. */
export default function ChartToolbar({ kind, kinds, fullscreen, onKind, onFullscreen, onPng, onCsv }: Props) {
  const [more, setMore] = useState(false);
  const main = (["bar", "line", "table"] as ChartKind[]).filter((k) => kinds.includes(k));
  const primary = kinds.includes(kind) && !main.includes(kind) ? [kind, ...main] : main;
  const extra = kinds.filter((k) => !primary.includes(k));

  return (
    <div className="flex items-center gap-2 pt-3">
      <div role="group" aria-label="Chart type" className="flex rounded-lg border border-border p-1">
        {primary.map((k) => (
          <button
            key={k}
            onClick={() => onKind(k)}
            aria-pressed={kind === k}
            className={`rounded px-2 text-ui transition-colors ${kind === k ? "bg-hover font-medium text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
        {extra.length > 0 && (
          <div className="relative" onKeyDown={(e) => e.key === "Escape" && more && (e.stopPropagation(), setMore(false))}>
            <button
              onClick={() => setMore(!more)}
              aria-expanded={more}
              aria-haspopup="menu"
              aria-label="More chart types"
              className={`rounded px-2 text-ui ${extra.includes(kind) ? "bg-hover font-medium text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {extra.includes(kind) ? KIND_LABEL[kind] : "More"}
            </button>
            {more && (
              <>
                <button aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setMore(false)} />
                <div role="menu" className="depth-2 absolute bottom-8 left-0 z-40 min-w-36 rounded-lg border border-border bg-card p-1">
                  {extra.map((k) => (
                    <button
                      key={k}
                      role="menuitemradio"
                      aria-checked={kind === k}
                      onClick={() => {
                        onKind(k);
                        setMore(false);
                      }}
                      className={`block w-full rounded px-3 py-1 text-left text-ui ${kind === k ? "bg-hover font-medium" : "hover:bg-hover"}`}
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
      <div className="flex-1" />
      <button onClick={onFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"} className={icon}>
        <Icon d={fullscreen ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"} />
      </button>
      <button onClick={onPng} disabled={kind === "table"} aria-label="Download PNG" title="Download PNG" className={icon}>
        <Icon d="M4 16l4-4 4 4 3-3 5 5M4 4h16v16H4z" />
      </button>
      <button onClick={onCsv} aria-label="Download CSV" title="Download CSV" className={icon}>
        <Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />
      </button>
    </div>
  );
}
