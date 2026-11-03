"use client";

import { useEffect, useRef } from "react";

/** A full-screen layer for one chart. Esc or the close button returns to the page. */
export default function ChartFullscreen({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <button aria-label="Close full screen" className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Chart, full screen"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation(); // close this only, not the canvas behind it
            onClose();
          }
        }}
        className="glass max-lg:bg-panel depth chart-in relative w-full max-w-6xl rounded-3xl p-5 outline-none"
      >
        <button onClick={onClose} aria-label="Close full screen" className="btn-ghost absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
