type Chip = { text: string; onClick: () => void };

export default function SuggestionChips({ label, chips }: { label: string; chips: Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.text}
            onClick={c.onClick}
            className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-left text-sm shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50"
          >
            {c.text}
          </button>
        ))}
      </div>
    </div>
  );
}
