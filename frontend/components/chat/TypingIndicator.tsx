export default function TypingIndicator() {
  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-glass-strong px-4 py-3 text-sm text-muted">
        <span aria-hidden>
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
        Working out the answer…
      </div>
    </div>
  );
}
