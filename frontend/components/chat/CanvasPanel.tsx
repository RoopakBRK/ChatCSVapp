"use client";

import { useEffect, useState } from "react";
import type { FileSummary, Relationship } from "@/lib/api";
import type { ChatItem } from "@/hooks/useChat";
import { usePanelWidth } from "@/hooks/usePanelWidth";
import DataSummary from "@/components/upload/DataSummary";
import type { ChartKind } from "@/components/charts/chartKinds";
import EdgeResizer from "./EdgeResizer";
import ResultCard from "./ResultCard";

type AnswerItem = Extract<ChatItem, { kind: "answer" }>;
type Props = {
  open: boolean;
  files: FileSummary[];
  relationships: Relationship[];
  answers: AnswerItem[];
  focus: { id: string } | null;
  views: Record<string, ChartKind>;
  onKind: (id: string, kind: ChartKind) => void;
  onUnpin: (item: AnswerItem) => void;
  onRemoveFile: (name: string) => Promise<void>;
  onClose: () => void;
};

/**
 * The canvas: the cleaned tables, then the answers you pinned (chart, SQL and data).
 * Desktop: slides in from the right and can be resized by dragging its left edge.
 * Phones and tablets: a bottom sheet.
 */
export default function CanvasPanel({ open, files, relationships, answers, focus, views, onKind, onUnpin, onRemoveFile, onClose }: Props) {
  const panel = usePanelWidth({ key: "chatcsv.canvas", min: 360, max: 900, initial: 480 });
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  useEffect(() => {
    if (open && focus) document.getElementById(`result-${focus.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open, focus]);

  if (!open) return null;
  return (
    <>
      <button aria-label="Close canvas" onClick={onClose} className="fixed inset-0 z-30 bg-scrim lg:hidden" />
      <EdgeResizer
        edge="left"
        label="Resize canvas"
        width={dragWidth ?? panel.width}
        min={panel.min}
        max={panel.max}
        initial={panel.initial}
        clamp={panel.clamp}
        onDrag={setDragWidth}
        onCommit={(w) => {
          panel.setWidth(w);
          setDragWidth(null);
        }}
      />
      <aside
        aria-label="Canvas"
        style={{ "--canvas-w": `${dragWidth ?? panel.width}px` } as React.CSSProperties}
        className="glass max-lg:bg-panel slide-up lg:slide-in fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] flex-col rounded-t-3xl lg:static lg:z-auto lg:h-auto lg:w-[var(--canvas-w)] lg:shrink-0 lg:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong lg:hidden" aria-hidden />
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-2xl leading-none">Canvas</h2>
          <button onClick={onClose} aria-label="Close canvas" title="Close canvas (Esc)" className="btn-ghost flex h-8 w-8 items-center justify-center rounded-full">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {files.length === 0 && answers.length === 0 && (
            <p className="text-sm text-muted">Your cleaned tables and any answers you pin will appear here.</p>
          )}
          {files.length > 0 && <DataSummary files={files} relationships={relationships} onRemove={onRemoveFile} />}
          {files.length > 0 && answers.length === 0 && (
            <p className="rounded-xl border border-dashed border-border-strong px-4 py-5 text-center text-sm text-muted">
              Use <span className="font-medium text-foreground">Pin to canvas</span> under an answer to keep its chart here.
            </p>
          )}
          {answers.map((a) => (
            <ResultCard
              key={a.id}
              id={a.id}
              question={a.question}
              answer={a.answer}
              highlighted={a.id === focus?.id}
              kind={views[a.id]}
              onKind={(k) => onKind(a.id, k)}
              onUnpin={() => onUnpin(a)}
            />
          ))}
        </div>
      </aside>
    </>
  );
}
