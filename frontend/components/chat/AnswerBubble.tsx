import type { ChatAnswer } from "@/lib/api";

type Props = { answer: ChatAnswer; onOpenResults: () => void };

/** In the chat an answer is just the explanation. Its chart, SQL and data live in the results panel. */
export default function AnswerBubble({ answer, onOpenResults }: Props) {
  return (
    <div className="depth max-w-[75%] space-y-2 rounded-2xl rounded-bl-md border border-border bg-white px-4 py-3">
      <p className="whitespace-pre-line text-sm leading-6">{answer.explanation}</p>
      <button
        onClick={onOpenResults}
        className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition-colors hover:bg-pink-50 hover:text-pink-700"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
        {answer.chart ? "View chart & data in results" : "View data in results"}
      </button>
    </div>
  );
}
