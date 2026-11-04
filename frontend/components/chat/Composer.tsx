"use client";

import { useLayoutEffect, useRef, useState } from "react";
import AddFilesMenu from "@/components/upload/AddFilesMenu";
import type { FileSummary } from "@/lib/api";
import { formatCount } from "@/lib/format";
import VoiceButton from "./VoiceButton";

type Chip = { text: string; onClick: () => void };
type Props = {
  files: FileSummary[];
  followUps: Chip[];
  loading: boolean;
  uploading: boolean;
  placeholder: string;
  onSend: (text: string) => void;
  onStop: () => void;
  onAddFiles: (files: File[]) => void;
  onAddLink: (url: string) => Promise<boolean>;
};

export const COMPOSER_INPUT_ID = "composer-input"; // "/" focuses it (see app/chat/page.tsx)
const MAX_CHARS = 2000;
const WARN_AT = 1800; // the count only shows when you get close
const MAX_LINES = 6;

export default function Composer({ files, followUps, loading, uploading, placeholder, onSend, onStop, onAddFiles, onAddLink }: Props) {
  const [text, setText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null); // typing "@..."
  const [active, setActive] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);
  const before = useRef(""); // what was already typed when voice input started
  const hasFiles = files.length > 0;
  const canSend = hasFiles && !loading && text.trim().length > 0;

  // Grow with the text, up to six lines, then scroll.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const padding = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_LINES + padding)}px`;
  }, [text]);

  const options = mention ? files.filter((f) => f.table_name.toLowerCase().includes(mention.query)).slice(0, 8) : [];

  const trackMention = (value: string, caret: number) => {
    const m = /(^|\s)@(\w*)$/.exec(value.slice(0, caret));
    setMention(m ? { start: caret - m[2].length - 1, query: m[2].toLowerCase() } : null);
    setActive(0);
  };

  const insertTable = (name: string) => {
    if (!mention || !box.current) return;
    const caret = box.current.selectionStart;
    const next = `${text.slice(0, mention.start)}${name} ${text.slice(caret)}`;
    const at = mention.start + name.length + 1;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => box.current?.setSelectionRange(at, at));
  };

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    setMention(null);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mx-auto w-full max-w-[720px] px-4 pb-4"
    >
      {followUps.length > 0 && !loading && (
        <div className="mb-2 flex flex-wrap gap-2" aria-label="Follow-up suggestions">
          {followUps.map((c) => (
            <button key={c.text} type="button" onClick={c.onClick} className="chip msg-in whitespace-normal text-left">
              {c.text}
            </button>
          ))}
        </div>
      )}

      <div className="depth relative flex items-end gap-1 rounded-[28px] bg-card p-2 transition-shadow focus-within:ring-2 focus-within:ring-accent/40">
        {options.length > 0 && (
          <ul id="table-mentions" role="listbox" aria-label="Tables (arrow keys to choose, Enter to insert)" className="depth-2 absolute bottom-full left-12 z-30 mb-2 w-72 overflow-hidden rounded-lg border border-border bg-card p-1">
            {options.map((f, i) => (
              <li key={f.file_name} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep the cursor in the box
                    insertTable(f.table_name);
                  }}
                  className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-ui ${i === active ? "bg-accent-soft" : "hover:bg-hover"}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
                  <span className="flex-1 truncate font-mono">{f.table_name}</span>
                  <span className="font-mono text-muted">{formatCount(f.row_count)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <AddFilesMenu uploading={uploading} onFiles={onAddFiles} onLink={onAddLink} />
        <textarea
          ref={box}
          id={COMPOSER_INPUT_ID}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            trackMention(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={(e) => {
            if (options.length > 0) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertTable(options[active].table_name);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation(); // close the list only, not results too
                setMention(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          onBlur={() => setMention(null)}
          rows={1}
          maxLength={MAX_CHARS}
          placeholder={placeholder}
          disabled={!hasFiles}
          aria-label="Your question"
          aria-describedby={options.length > 0 ? "table-mentions" : undefined}
          className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-msg text-foreground outline-none placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed"
        />
        <VoiceButton
          disabled={!hasFiles || loading}
          onStart={() => {
            setVoiceError(null);
            before.current = text.trim();
          }}
          onText={(heard) => setText(before.current ? `${before.current} ${heard}` : heard)}
          onError={setVoiceError}
        />
        {loading ? (
          <button type="button" onClick={onStop} aria-label="Stop the answer" title="Stop" className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <span className="h-3.5 w-3.5 rounded-sm bg-on-accent" aria-hidden />
          </button>
        ) : (
          <button type="submit" disabled={!canSend} aria-label="Send" title="Send (Enter)" className="btn-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-start justify-between gap-3 px-3 text-ui empty:hidden">
        {voiceError && <p role="alert" className="mt-1 text-error-ink">{voiceError}</p>}
        {text.length >= WARN_AT && (
          <p className={`ml-auto mt-1 shrink-0 font-mono ${text.length >= MAX_CHARS - 50 ? "text-error-ink" : "text-muted"}`} aria-live="polite">
            {formatCount(text.length)} / {formatCount(MAX_CHARS)}
          </p>
        )}
      </div>
    </form>
  );
}
