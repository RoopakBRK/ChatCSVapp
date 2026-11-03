"use client";

import { useEffect, useRef } from "react";
import type { ChatItem } from "@/hooks/useChat";
import Notice from "@/components/Notice";
import DropTarget from "@/components/upload/DropTarget";
import UploadZone from "@/components/upload/UploadZone";
import Composer from "./Composer";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

type Props = {
  items: ChatItem[];
  loading: boolean;
  restored: boolean;
  hasFiles: boolean;
  uploading: boolean;
  uploadError: string | null;
  onDismissError: () => void;
  onSend: (text: string) => void;
  onFiles: (files: File[]) => void;
  onOpenResult: (id: string) => void;
};

export default function ChatPanel(p: Props) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [p.items, p.loading]);

  return (
    <DropTarget onFiles={p.onFiles}>
      <div className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
        <div className="mx-auto flex max-w-2xl flex-col items-stretch gap-4">
          {p.items.map((item) => (
            <MessageBubble key={item.id} item={item} onOpenResult={p.onOpenResult} />
          ))}
          {p.loading && <TypingIndicator />}

          {p.restored && !p.hasFiles && (
            <div className="mt-10 space-y-4 text-center">
              <h2 className="text-2xl font-bold tracking-tight">
                <span className="text-gradient-brand">Start by adding your CSV files</span>
              </h2>
              <UploadZone onFiles={p.onFiles} uploading={p.uploading} />
            </div>
          )}
          {p.restored && p.hasFiles && p.items.length === 0 && (
            <p className="mt-16 text-center text-muted">Your files are ready. Ask a question about your tables.</p>
          )}
          <div ref={bottom} />
        </div>
      </div>

      {p.uploadError && (
        <div className="mx-auto w-full max-w-2xl px-3 pb-2">
          <Notice tone="error" onDismiss={p.onDismissError}>
            {p.uploadError}
          </Notice>
        </div>
      )}
      <Composer
        onSend={p.onSend}
        onAddFiles={p.onFiles}
        uploading={p.uploading}
        disabled={!p.hasFiles || p.loading}
        placeholder={p.hasFiles ? "Ask about your data…" : "Add CSV files with + to begin"}
      />
    </DropTarget>
  );
}
