"use client";

import { useRef } from "react";
import { clampFraction, RESULTS_DEFAULT } from "@/hooks/useResultsWidth";

type Props = {
  /** The element holding the chat and results side by side. */
  area: React.RefObject<HTMLDivElement | null>;
  fraction: number;
  onDrag: (fraction: number) => void; // live, while dragging
  onCommit: (fraction: number) => void; // saved, when the drag ends
};

/** The results panel's left edge (desktop only). Drag it, use the arrow keys, or double-click to reset. */
export default function ResultsResizer({ area, fraction, onDrag, onCommit }: Props) {
  const dragging = useRef(false);
  const at = (x: number) => {
    const r = area.current?.getBoundingClientRect();
    return r ? clampFraction((r.right - x) / r.width, r.width) : fraction;
  };
  const total = () => area.current?.getBoundingClientRect().width ?? 1000;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize results"
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      className="group relative z-20 -mx-1 hidden w-2 shrink-0 cursor-col-resize touch-none xl:block"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => dragging.current && onDrag(at(e.clientX))}
      onPointerUp={(e) => {
        if (!dragging.current) return;
        dragging.current = false;
        document.body.style.userSelect = "";
        onCommit(at(e.clientX));
      }}
      onDoubleClick={() => onCommit(clampFraction(RESULTS_DEFAULT, total()))}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onCommit(clampFraction(fraction + 0.02, total()));
        if (e.key === "ArrowRight") onCommit(clampFraction(fraction - 0.02, total()));
      }}
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
    </div>
  );
}
