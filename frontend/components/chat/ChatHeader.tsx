type Props = {
  resultsCount: number;
  resultsOpen: boolean;
  onToggleResults: () => void;
  onOpenHistory: () => void;
};

const pill =
  "flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50";

export default function ChatHeader({ resultsCount, resultsOpen, onToggleResults, onOpenHistory }: Props) {
  return (
    <header className="flex items-center justify-between gap-3">
      <button onClick={onOpenHistory} className={`${pill} md:invisible`}>
        History
      </button>
      <button onClick={onToggleResults} aria-pressed={resultsOpen} className={pill}>
        Results
        {resultsCount > 0 && (
          <span className="bg-gradient-brand rounded-full px-2 py-0.5 text-xs font-semibold text-white">{resultsCount}</span>
        )}
      </button>
    </header>
  );
}
