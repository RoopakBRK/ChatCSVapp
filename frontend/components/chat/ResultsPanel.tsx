"use client";

import { useEffect } from "react";
import type { FileSummary, Relationship } from "@/lib/api";
import type { ChatItem } from "@/hooks/useChat";
import DataSummary from "@/components/upload/DataSummary";
import ResultCard from "./ResultCard";

type AnswerItem = Extract<ChatItem, { kind: "answer" }>;
type Props = {
  open: boolean;
  files: FileSummary[];
  relationships: Relationship[];
  answers: AnswerItem[];
  focus: { id: string } | null;
  onClose: () => void;
};

/** Right-hand panel: the cleaned tables first, then every chart and data table as a thread. */
export default function ResultsPanel({ open, files, relationships, answers, focus, onClose }: Props) {
  useEffect(() => {
    if (open && focus) document.getElementById(`result-${focus.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open, focus]);

  if (!open) return null;
  return (
    <aside
      aria-label="Results"
      className="slide-in panel-results fixed inset-y-0 right-0 z-30 flex w-full max-w-[34rem] flex-col rounded-none lg:static lg:z-auto lg:w-[32rem] lg:max-w-none lg:rounded-2xl"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Results</h2>
        <button onClick={onClose} aria-label="Close results" className="rounded-lg px-2 py-1 text-lg leading-none text-muted hover:bg-pink-50">
          ×
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {files.length === 0 && answers.length === 0 && (
          <p className="text-sm text-muted">Charts, data tables and the cleaning summary will appear here.</p>
        )}
        {files.length > 0 && <DataSummary files={files} relationships={relationships} />}
        {answers.map((a) => (
          <ResultCard key={a.id} id={a.id} question={a.question} answer={a.answer} highlighted={a.id === focus?.id} />
        ))}
      </div>
    </aside>
  );
}
