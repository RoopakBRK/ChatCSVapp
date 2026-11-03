"use client";

import { useEffect, useRef } from "react";
import type { ChatItem } from "@/hooks/useChat";
import type { FileProgress } from "@/hooks/useFiles";
import type { ChatStep, FileSummary } from "@/lib/api";
import { followUps } from "@/lib/followups";
import Notice from "@/components/Notice";
import DropTarget from "@/components/upload/DropTarget";
import UploadProgress from "@/components/upload/UploadProgress";
import Composer from "./Composer";
import EmptyState from "./EmptyState";
import MessageBubble from "./MessageBubble";
import ProgressSteps from "./ProgressSteps";
import SuggestionChips from "./SuggestionChips";

type Props = {
  items: ChatItem[];
  files: FileSummary[];
  starters: string[];
  progress: FileProgress[];
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
  onSample: () => void;
};

/** The conversation, centred in a 720px column, with the composer underneath. */
export default function ChatPanel(p: Props) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [p.items, p.loading, p.step, p.progress]);

  const hasFiles = p.files.length > 0;
  const last = p.items[p.items.length - 1];
  const asked = p.items.some((i) => i.kind === "user");
  const showStarters = hasFiles && p.starters.length > 0 && !p.loading && !asked;
  const lastAnswer = !p.loading && last?.kind === "answer" ? last : null;
  const chips = lastAnswer ? followUps(lastAnswer.answer, p.files).map((f) => ({ text: f.label, onClick: () => p.onSend(f.text) })) : [];

  return (
    <DropTarget onFiles={p.onFiles}>
      <div className="flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-6">
          {p.restored && !hasFiles && p.progress.length === 0 && <EmptyState uploading={p.uploading} onFiles={p.onFiles} onSample={p.onSample} />}

          {p.items.map((item) => (
            <MessageBubble key={item.id} item={item} />
          ))}
          <UploadProgress items={p.progress} />
          {p.loading && <ProgressSteps step={p.step} onStop={p.onStop} />}

          {showStarters && (
            <div className="msg-in">
              <SuggestionChips label="Try asking" chips={p.starters.slice(0, 4).map((text) => ({ text, onClick: () => p.onSend(text) }))} />
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      {p.uploadError && (
        <div className="mx-auto w-full max-w-[720px] px-4 pb-2">
          <Notice tone="error" onDismiss={p.onDismissError}>
            {p.uploadError}
          </Notice>
        </div>
      )}
      <Composer
        files={p.files}
        followUps={chips}
        loading={p.loading}
        uploading={p.uploading}
        placeholder={hasFiles ? "Ask about your data… (type @ for a table)" : "Add CSV files with + to begin"}
        onSend={p.onSend}
        onStop={p.onStop}
        onAddFiles={p.onFiles}
        onAddLink={p.onAddLink}
      />
    </DropTarget>
  );
}
