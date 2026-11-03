import Notice from "@/components/Notice";
import type { ChatItem } from "@/hooks/useChat";
import AnswerBubble from "./AnswerBubble";

type Props = { item: ChatItem; onOpenResult: (id: string) => void };

export default function MessageBubble({ item, onOpenResult }: Props) {
  switch (item.kind) {
    case "user":
      return (
        <div className="flex justify-end">
          <p className="bg-gradient-brand max-w-[70%] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
            {item.text}
          </p>
        </div>
      );
    case "answer":
      return <AnswerBubble answer={item.answer} onOpenResults={() => onOpenResult(item.id)} />;
    case "clarification":
      return (
        <div className="depth max-w-[75%] rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm leading-6">
          <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-pink-600">I need a bit more detail</span>
          {item.text}
        </div>
      );
    case "error":
      return <Notice tone="error">{item.text}</Notice>;
    case "text":
      return item.role === "system" ? (
        <p className="self-center rounded-full bg-sky-50 px-3 py-1 text-xs text-muted">{item.text}</p>
      ) : (
        <p className="depth max-w-[75%] whitespace-pre-wrap rounded-2xl border border-border bg-white px-4 py-2.5 text-sm leading-6">
          {item.text}
        </p>
      );
  }
}
