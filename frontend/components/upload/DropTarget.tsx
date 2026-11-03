"use client";

import { useState } from "react";

/** Lets CSVs be dropped anywhere on its children. */
export default function DropTarget({ onFiles, children }: { onFiles: (files: File[]) => void; children: React.ReactNode }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {children}
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-pink-300 bg-white/85 text-sm font-semibold">
          Drop CSV files to add them
        </div>
      )}
    </div>
  );
}
