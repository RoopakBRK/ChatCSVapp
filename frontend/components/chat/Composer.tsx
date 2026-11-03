"use client";

import { useState } from "react";
import AddFilesMenu from "@/components/upload/AddFilesMenu";

type Props = {
  onSend: (text: string) => void;
  onAddFiles: (files: File[]) => void;
  onAddLink: (url: string) => Promise<boolean>;
  disabled: boolean;
  uploading: boolean;
  placeholder: string;
};

export default function Composer({ onSend, onAddFiles, onAddLink, disabled, uploading, placeholder }: Props) {
  const [text, setText] = useState("");
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
      <AddFilesMenu uploading={uploading} onFiles={onAddFiles} onLink={onAddLink} />
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
        className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-pink-300"
      />
      <button
        type="submit"
        disabled={!canSend}
        className="bg-gradient-brand flex h-12 items-center gap-2 rounded-full px-7 text-base font-semibold text-white shadow-md transition-opacity disabled:opacity-40"
      >
        Ask
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </form>
  );
}
