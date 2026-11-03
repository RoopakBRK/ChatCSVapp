import Notice from "@/components/Notice";
import type { ChatItem } from "@/hooks/useChat";

type Props = { item: ChatItem; onOpenResult: (id: string) => void };

export default function MessageBubble({ item, onOpenResult }: Props) {
  switch (item.kind) {
    case "user":
      return (
        <div className="flex justify-end">
          <p className="bg-gradient-brand max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
            {item.text}
          </p>
        </div>
      );
    case "answer":
      return (
        <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-md border border-border bg-white px-4 py-3 shadow-sm">
          <p className="whitespace-pre-line text-sm leading-6">{item.answer.explanation}</p>
          <button
            onClick={() => onOpenResult(item.id)}
            className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition-colors hover:bg-pink-50 hover:text-pink-700"
          >
            {item.answer.chart ? "View chart & data →" : "View data →"}
          </button>
        </div>
      );
    case "clarification":
      return (
        <div className="max-w-[85%] rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm leading-6">
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
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-border bg-white px-4 py-2.5 text-sm leading-6">
          {item.text}
        </p>
      );
  }
}
