"use client";

import { useRef, useState } from "react";

type Props = { onFiles: (files: File[]) => void; uploading: boolean };

export default function UploadZone({ onFiles, uploading }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV files"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation(); // the surrounding DropTarget must not upload them a second time
          setDragging(false);
          onFiles(Array.from(e.dataTransfer.files));
        }}
        data-active={dragging}
        className={`drop-glow cursor-pointer rounded-lg border border-dashed px-6 py-6 text-center ${
 dragging ? "border-accent bg-accent-soft" : "border-border-strong bg-panel/50"
 }`}
      >
        <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-ink" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 17v3h16v-3M12 3v12m0-12-4 4m4-4 4 4" />
          </svg>
        </span>
        {uploading ? (
          <p className="text-ui font-medium">Cleaning your files…</p>
        ) : (
          <>
            <p className="text-ui font-medium">Drop CSV files or click to choose</p>
            <p className="text-ui text-muted">Up to 50 MB each</p>
          </>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        multiple
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = ""; // lets the same file be picked again
        }}
      />
    </>
  );
}
