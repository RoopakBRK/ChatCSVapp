type Props = { tone: "error" | "info"; children: React.ReactNode; onDismiss?: () => void };

const TONES = {
  error: "border-rose-300/60 bg-rose-100/70 text-rose-900",
  info: "border-sky-300/60 bg-sky-100/70 text-sky-900",
};

export default function Notice({ tone, children, onDismiss }: Props) {
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${TONES[tone]}`}>
      <p className="min-w-0 flex-1 whitespace-pre-line">{children}</p>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded px-1 opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
}
