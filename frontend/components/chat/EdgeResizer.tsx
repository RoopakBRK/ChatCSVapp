"use client";

import { useRef } from "react";

type Props = {
  /** Which side of the panel this handle sits on. A handle on the left edge grows the panel when dragged left. */
  edge: "left" | "right";
  label: string;
  width: number;
  min: number;
  max: number;
  initial: number;
  clamp: (w: number) => number;
  onDrag: (width: number) => void; // live, while dragging
  onCommit: (width: number) => void; // saved, when the drag ends
};

/** A draggable panel edge. Arrow keys work too, and double-click resets the width. */
export default function EdgeResizer({ edge, label, width, min, max, initial, clamp, onDrag, onCommit }: Props) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const sign = edge === "right" ? 1 : -1;
  const next = (x: number) => clamp(start.current!.width + sign * (x - start.current!.x));

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      className="group relative z-20 -mx-2 hidden w-3 shrink-0 cursor-col-resize touch-none lg:block"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, width };
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => start.current && onDrag(next(e.clientX))}
      onPointerUp={(e) => {
        if (!start.current) return;
        onCommit(next(e.clientX));
        start.current = null;
        document.body.style.userSelect = "";
      }}
      onDoubleClick={() => onCommit(initial)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onCommit(clamp(width - 16 * sign));
        if (e.key === "ArrowRight") onCommit(clamp(width + 16 * sign));
      }}
    >
      <span className="absolute inset-y-8 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
    </div>
  );
}
