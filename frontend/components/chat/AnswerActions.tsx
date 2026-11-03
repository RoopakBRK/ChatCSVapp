"use client";

import { useState } from "react";

type Props = {
  sqlOpen: boolean;
  tableOpen: boolean;
  pinned: boolean;
  onCopy: () => Promise<void>;
  onSql: () => void;
  onTable: () => void;
  onCsv: () => void;
  onPin: () => void;
};

const Icon = ({ d }: { d: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const base = "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors";
const idle = `${base} text-muted hover:bg-hover hover:text-foreground`;
const on = `${base} bg-accent-soft text-foreground`;

/** Copy · View SQL · View table · Download CSV · Pin to canvas. */
export default function AnswerActions({ sqlOpen, tableOpen, pinned, onCopy, onSql, onTable, onCsv, onPin }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="-ml-2 flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Answer actions">
      <button
        className={idle}
        onClick={async () => {
          await onCopy();
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Icon d={copied ? "M5 12l5 5 9-11" : "M9 9h11v11H9zM5 15H4V4h11v1"} />
        {copied ? "Copied" : "Copy"}
      </button>
      <button className={sqlOpen ? on : idle} aria-pressed={sqlOpen} onClick={onSql}>
        <Icon d="M9 18l-6-6 6-6M15 6l6 6-6 6" /> View SQL
      </button>
      <button className={tableOpen ? on : idle} aria-pressed={tableOpen} onClick={onTable}>
        <Icon d="M3 5h18v14H3zM3 10h18M9 5v14" /> View table
      </button>
      <button className={idle} onClick={onCsv}>
        <Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" /> Download CSV
      </button>
      <button className={pinned ? on : idle} aria-pressed={pinned} onClick={onPin}>
        <Icon d="M12 17v5M5 17h14l-2-4V5H7v8l-2 4z" /> {pinned ? "Pinned" : "Pin to canvas"}
      </button>
    </div>
  );
}
