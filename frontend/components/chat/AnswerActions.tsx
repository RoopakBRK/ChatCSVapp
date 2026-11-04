"use client";

import { useState } from "react";

type Props = { onCopy: () => Promise<void>; onCsv?: () => void };

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const btn = "flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground";

/** Copy and CSV, as small icons that show when the answer is hovered or focused. */
export default function AnswerActions({ onCopy, onCsv }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="hover-reveal flex items-center gap-1" role="toolbar" aria-label="Answer actions">
      <button
        className={btn}
        aria-label={copied ? "Copied" : "Copy answer"}
        title={copied ? "Copied" : "Copy"}
        onClick={async () => {
          await onCopy();
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Icon d={copied ? "M5 12l5 5 9-11" : "M9 9h11v11H9zM5 15H4V4h11v1"} />
      </button>
      {onCsv && (
        <button className={btn} aria-label="Download CSV" title="Download CSV" onClick={onCsv}>
          <Icon d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />
        </button>
      )}
    </div>
  );
}
