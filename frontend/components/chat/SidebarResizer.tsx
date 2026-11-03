"use client";

import { useRef } from "react";
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, clampWidth } from "@/hooks/useSidebar";

type Props = {
  width: number;
  onDrag: (width: number) => void; // live, while dragging
  onCommit: (width: number) => void; // saved, when the drag ends
};

/** The draggable edge of the sidebar. Also works with the keyboard (arrow keys) and resets on double-click. */
export default function SidebarResizer({ width, onDrag, onCommit }: Props) {
  const start = useRef<{ x: number; width: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize history"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      className="group relative z-20 -mx-2 hidden w-3 shrink-0 cursor-col-resize touch-none md:block"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, width };
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => {
        if (start.current) onDrag(clampWidth(start.current.width + e.clientX - start.current.x));
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        onCommit(clampWidth(start.current.width + e.clientX - start.current.x));
        start.current = null;
        document.body.style.userSelect = "";
      }}
      onDoubleClick={() => onCommit(SIDEBAR_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onCommit(width - 16);
        if (e.key === "ArrowRight") onCommit(width + 16);
      }}
    >
      <span className="absolute inset-y-6 left-1/2 w-1 -translate-x-1/2 rounded-full bg-indigo-300/0 transition-colors group-hover:bg-indigo-300/70 group-focus-visible:bg-pink-400" />
    </div>
  );
}
