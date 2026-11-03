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
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
          dragging ? "border-pink-400 bg-pink-50" : "border-sky-300 bg-white/60 hover:border-pink-400 hover:bg-white"
        }`}
      >
        {uploading ? (
          <p className="text-sm font-medium">Reading and cleaning your files…</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drop CSV files here</p>
            <p className="mt-1 text-xs text-muted">or click to choose several at once</p>
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
