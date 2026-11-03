import type { FileSummary } from "@/lib/api";
import { formatCount } from "@/lib/format";
import ThemeToggle from "./ThemeToggle";

type Props = {
  title: string;
  files: FileSummary[];
  canvasOpen: boolean;
  canvasCount: number;
  onToggleCanvas: () => void;
  onOpenHistory: () => void;
};

/** Chat title in the serif face, the loaded tables, the theme switch and the canvas toggle. */
export default function ChatHeader({ title, files, canvasOpen, canvasCount, onToggleCanvas, onOpenHistory }: Props) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <button onClick={onOpenHistory} aria-label="Open chats" className="btn-ghost flex h-9 w-9 shrink-0 items-center justify-center rounded-full md:hidden">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </button>

      <h1 className="min-w-0 shrink truncate text-2xl leading-tight" title={title}>
        {title}
      </h1>

      <div
        className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden"
        aria-label="Loaded tables"
      >
        {files.map((f) => (
          <span key={f.file_name} className="chip" title={f.file_name}>
            <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
            {f.table_name}
            <span className="font-mono text-muted">{formatCount(f.row_count)}</span>
          </span>
        ))}
      </div>
      <div className="flex-1 sm:hidden" />

      <ThemeToggle />
      <button
        onClick={onToggleCanvas}
        aria-pressed={canvasOpen}
        aria-label={`${canvasOpen ? "Close" : "Open"} canvas`}
        title={`${canvasOpen ? "Close" : "Open"} canvas${canvasOpen ? " (Esc)" : ""}`}
        className={`flex h-9 items-center gap-2 rounded-full px-3 text-sm ${canvasOpen ? "btn-accent" : "btn-ghost"}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M14 4v16" />
        </svg>
        <span className="hidden sm:inline">Canvas</span>
        {canvasCount > 0 && <span className="font-mono text-xs opacity-80">{canvasCount}</span>}
      </button>
    </header>
  );
}
