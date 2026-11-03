"use client";

import { createContext, useContext } from "react";
import type { ChartKind } from "@/components/charts/chartKinds";
import type { ChatAnswer, FileSummary } from "@/lib/api";

/** What answer cards need from the page: chart views, pins, retry, and the canvas. */
export type ChatUI = {
  files: FileSummary[];
  views: Record<string, ChartKind>;
  setKind: (answerId: string, kind: ChartKind) => void;
  isPinned: (answer: ChatAnswer, question: string) => boolean;
  togglePin: (answerId: string, answer: ChatAnswer, question: string) => void;
  retry: (errorId: string) => void;
  openInCanvas: (answerId: string) => void;
};

export const ChatUIContext = createContext<ChatUI | null>(null);

export function useChatUI(): ChatUI {
  const ui = useContext(ChatUIContext);
  if (!ui) throw new Error("useChatUI must be used inside ChatUIContext");
  return ui;
}
