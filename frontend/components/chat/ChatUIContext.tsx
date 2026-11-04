"use client";

import { createContext, useContext } from "react";
import type { ChartKind } from "@/components/charts/chartKinds";
import type { FileSummary } from "@/lib/api";

/** What answers in the chat need from the page: chart views, retry, and the results panel. */
export type ChatUI = {
  files: FileSummary[];
  views: Record<string, ChartKind>;
  retry: (errorId: string) => void;
  /** The answer currently shown in results (null when a table or nothing is shown). */
  shownId: string | null;
  showInResults: (answerId: string) => void;
};

export const ChatUIContext = createContext<ChatUI | null>(null);

export function useChatUI(): ChatUI {
  const ui = useContext(ChatUIContext);
  if (!ui) throw new Error("useChatUI must be used inside ChatUIContext");
  return ui;
}
