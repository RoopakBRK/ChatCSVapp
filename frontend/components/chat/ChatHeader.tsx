import ThemeToggle from "./ThemeToggle";

type Props = {
  title: string;
  resultsOpen: boolean; // below 1280px only; on desktop results is always shown
  resultsCount: number;
  onToggleResults: () => void;
  onOpenHistory: () => void;
};

/**
 * Chat title and the theme switch. Phones get a Chat | Results switch; 768–1279px a Results button
 * (the panel slides over the chat). On desktop results is always open, so there is no button.
 */
export default function ChatHeader({ title, resultsOpen, resultsCount, onToggleResults, onOpenHistory }: Props) {
  const seg = (on: boolean) => `rounded px-3 text-ui ${on ? "bg-hover font-medium text-foreground" : "text-muted"}`;
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <button onClick={onOpenHistory} aria-label="Open chats" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-foreground md:hidden">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </button>
      <h1 className="hidden min-w-0 flex-1 truncate text-head md:block" title={title}>
        {title}
      </h1>

      <div role="group" aria-label="Show" className="flex flex-1 justify-center md:hidden">
        <div className="flex rounded-lg border border-border p-1">
          <button onClick={() => resultsOpen && onToggleResults()} aria-pressed={!resultsOpen} className={seg(!resultsOpen)}>
            Chat
          </button>
          <button onClick={() => !resultsOpen && onToggleResults()} aria-pressed={resultsOpen} className={seg(resultsOpen)}>
            Results{resultsCount > 0 && <span className="ml-1 font-mono">{resultsCount}</span>}
          </button>
        </div>
      </div>

      <ThemeToggle />
      <button
        onClick={onToggleResults}
        aria-pressed={resultsOpen}
        aria-label={`${resultsOpen ? "Close" : "Open"} results`}
        title={resultsOpen ? "Close results (Esc)" : "Open results"}
        className={`hidden h-8 items-center gap-2 rounded-lg px-2 text-ui md:flex xl:hidden ${resultsOpen ? "bg-hover text-foreground" : "text-muted hover:bg-hover hover:text-foreground"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M14 4v16" />
        </svg>
        Results
        {resultsCount > 0 && <span className="font-mono">{resultsCount}</span>}
      </button>
    </header>
  );
}
