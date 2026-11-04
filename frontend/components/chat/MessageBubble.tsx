"use client";

import type { ChatItem } from "@/hooks/useChat";
import AnswerCard from "./AnswerCard";
import Markdown from "./Markdown";
import { useChatUI } from "./ChatUIContext";

/** One message. New ones (made in this visit) fade in; restored history doesn't. */
export default function MessageBubble({ item }: { item: ChatItem }) {
  const ui = useChatUI();
  const enter = item.fresh ? "msg-in" : "";

  switch (item.kind) {
    case "user":
      return (
        <div className={`flex justify-end ${enter}`}>
          <p className="bubble max-w-[75%] whitespace-pre-wrap px-4 py-2 text-msg">{item.text}</p>
        </div>
      );
    case "answer":
      return (
        <div className={enter}>
          <AnswerCard id={item.id} question={item.question} answer={item.answer} fresh={!!item.fresh} />
        </div>
      );
    case "clarification":
      return <Markdown text={item.text} className={`reply-card w-fit max-w-[90%] space-y-2 border-l-4 border-l-accent px-4 py-2 text-msg ${enter}`} />;
    case "error":
      return (
        <div role="alert" className={`flex items-start gap-3 rounded-lg border border-error/40 bg-error-soft px-3 py-2 ${enter}`}>
          <p className="min-w-0 flex-1 whitespace-pre-line text-msg">{item.text}</p>
          {item.retry && (
            <button onClick={() => ui.retry(item.id)} className="btn-ghost shrink-0 rounded-lg px-3 py-1 text-ui font-medium">
              Retry
            </button>
          )}
        </div>
      );
    case "text":
      return item.role === "system" ? (
        <p className={`self-center text-ui text-muted ${enter}`}>{item.text}</p>
      ) : (
        <Markdown text={item.text} className={`reply-card w-fit max-w-[90%] space-y-2 px-4 py-2 text-msg ${enter}`} />
      );
  }
}
