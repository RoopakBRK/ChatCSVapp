type Props = {
  resultsCount: number;
  resultsOpen: boolean;
  onToggleResults: () => void;
  onOpenHistory: () => void;
};

/** Floats over the top corners of the chat card, so the card itself can run all the way to the top. */
export default function ChatHeader({ resultsCount, resultsOpen, onToggleResults, onOpenHistory }: Props) {
  return (
    <>
      <button
        onClick={onOpenHistory}
        className="absolute left-3 top-3 z-10 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium shadow-sm md:hidden"
      >
        History
      </button>

      {/* Round avatar-style button that shows or hides the results panel */}
      <button
        onClick={onToggleResults}
        aria-pressed={resultsOpen}
        aria-label={`Results${resultsCount ? ` (${resultsCount})` : ""}`}
        title="Results"
        className={`bg-gradient-brand absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md ring-2 transition-transform hover:scale-105 ${
          resultsOpen ? "ring-pink-300" : "ring-white"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
        {resultsCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-pink-600 shadow ring-1 ring-pink-200">
            {resultsCount}
          </span>
        )}
      </button>
    </>
  );
}
