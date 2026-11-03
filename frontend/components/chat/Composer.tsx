"use client";

import { useRef, useState } from "react";

type Props = {
  onSend: (text: string) => void;
  onAddFiles: (files: File[]) => void;
  disabled: boolean;
  uploading: boolean;
  placeholder: string;
};

export default function Composer({ onSend, onAddFiles, disabled, uploading, placeholder }: Props) {
  const [text, setText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const canSend = !disabled && text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 border-t border-border p-3"
    >
      <div className="group relative">
        <button
          type="button"
          aria-label="Add files"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-2xl leading-none text-pink-500 shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50 disabled:opacity-50"
        >
          {uploading ? <span className="text-xs text-muted">…</span> : "+"}
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        >
          Add files
        </span>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          multiple
          hidden
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []));
            e.target.value = ""; // lets the same file be picked again
          }}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        maxLength={2000}
        placeholder={placeholder}
        aria-label="Your question"
        className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-white px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-pink-300"
      />
      <button
        type="submit"
        disabled={!canSend}
        className="bg-gradient-brand h-11 rounded-full px-6 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-40"
      >
        Ask
      </button>
    </form>
  );
}
