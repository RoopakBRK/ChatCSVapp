"use client";

import { useEffect, useRef } from "react";
import type { ChatItem } from "@/hooks/useChat";
import type { ChatStep, FileSummary } from "@/lib/api";
import { followUps } from "@/lib/followups";
import Notice from "@/components/Notice";
import DropTarget from "@/components/upload/DropTarget";
import UploadZone from "@/components/upload/UploadZone";
import Composer from "./Composer";
import MessageBubble from "./MessageBubble";
import ProgressSteps from "./ProgressSteps";
import SuggestionChips from "./SuggestionChips";

type Props = {
  items: ChatItem[];
  files: FileSummary[];
  starters: string[];
  loading: boolean;
  step: ChatStep | null;
  restored: boolean;
  uploading: boolean;
  uploadError: string | null;
  onDismissError: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onFiles: (files: File[]) => void;
  onAddLink: (url: string) => Promise<boolean>;
  onOpenResult: (id: string) => void;
};

export default function ChatPanel(p: Props) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [p.items, p.loading, p.step]);

  const hasFiles = p.files.length > 0;
  const last = p.items[p.items.length - 1];
  const showStarters = hasFiles && p.starters.length > 0 && !p.loading && !p.items.some((i) => i.kind === "user");
  const lastAnswer = !p.loading && last?.kind === "answer" ? last : null;

  return (
    <DropTarget onFiles={p.onFiles}>
      <div className="flex-1 overflow-y-auto px-4 pb-5 pt-16 md:px-6" aria-live="polite">
        <div className="flex w-full flex-col items-stretch gap-4">
          {p.items.map((item) => (
            <MessageBubble key={item.id} item={item} onOpenResult={p.onOpenResult} />
          ))}
          {p.loading && <ProgressSteps step={p.step} onStop={p.onStop} />}

          {showStarters && (
            <SuggestionChips
              label="Try asking"
              chips={p.starters.map((text) => ({ text, onClick: () => p.onSend(text) }))}
            />
          )}
          {lastAnswer && (
            <SuggestionChips
              label="Follow up"
              chips={followUps(lastAnswer.answer, p.files).map((f) => ({
                text: f.label,
                onClick: () => p.onSend(f.text),
              }))}
            />
          )}

          {p.restored && !hasFiles && (
            <div className="mx-auto mt-10 w-full max-w-2xl space-y-4 text-center">
              <h2 className="text-2xl font-bold tracking-tight">
                <span className="text-gradient-brand">Start by adding your CSV files</span>
              </h2>
              <UploadZone onFiles={p.onFiles} uploading={p.uploading} />
            </div>
          )}
          {p.restored && hasFiles && p.items.length === 0 && !showStarters && (
            <p className="mt-16 text-center text-muted">Your files are ready. Ask a question about your tables.</p>
          )}
          <div ref={bottom} />
        </div>
      </div>

      {p.uploadError && (
        <div className="w-full px-4 pb-2 md:px-6">
          <Notice tone="error" onDismiss={p.onDismissError}>
            {p.uploadError}
          </Notice>
        </div>
      )}
      <Composer
        onSend={p.onSend}
        onAddFiles={p.onFiles}
        onAddLink={p.onAddLink}
        uploading={p.uploading}
        disabled={!hasFiles || p.loading}
        placeholder={hasFiles ? "Ask about your data…" : "Add CSV files with + to begin"}
      />
    </DropTarget>
  );
}
