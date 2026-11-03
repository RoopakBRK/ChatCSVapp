"use client";

import type { ChatItem } from "@/hooks/useChat";
import AnswerCard from "./AnswerCard";
import { useChatUI } from "./ChatUIContext";

/** One message. New ones (made in this visit) fade in and rise a little; restored history doesn't. */
export default function MessageBubble({ item }: { item: ChatItem }) {
  const ui = useChatUI();
  const enter = item.fresh ? "msg-in" : "";

  switch (item.kind) {
    case "user":
      return (
        <div className={`flex justify-end ${enter}`}>
          <p className="card depth max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-lg px-4 py-2.5 text-[15px] leading-6">{item.text}</p>
        </div>
      );
    case "answer":
      return (
        <div className={enter}>
          <AnswerCard id={item.id} question={item.question} answer={item.answer} fresh={!!item.fresh} />
        </div>
      );
    case "clarification":
      return (
        <div className={`flex max-w-[90%] gap-3 rounded-2xl rounded-bl-lg border border-accent bg-card px-4 py-3 ${enter}`}>
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent font-display text-sm text-accent-ink" aria-hidden>
            ?
          </span>
          <div>
            <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-accent-ink">A quick question first</span>
            <p className="text-[15px] leading-6">{item.text}</p>
          </div>
        </div>
      );
    case "error":
      return (
        <div role="alert" className={`flex max-w-[90%] items-start gap-3 rounded-2xl border border-error/50 bg-error-soft px-4 py-3 ${enter}`}>
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error font-bold text-panel" aria-hidden>
            !
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="whitespace-pre-line text-[15px] leading-6">{item.text}</p>
            {item.retry && (
              <button onClick={() => ui.retry(item.id)} className="btn-ghost rounded-full px-3 py-1 text-xs font-semibold">
                Retry
              </button>
            )}
          </div>
        </div>
      );
    case "text":
      return item.role === "system" ? (
        <p className={`self-center rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted ${enter}`}>{item.text}</p>
      ) : (
        <p className={`card max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-lg px-4 py-2.5 text-[15px] leading-6 ${enter}`}>{item.text}</p>
      );
  }
}
