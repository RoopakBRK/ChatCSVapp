type Chip = { text: string; onClick: () => void };

export default function SuggestionChips({ label, chips }: { label: string; chips: Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c.text} onClick={c.onClick} className="chip whitespace-normal py-1.5 text-left text-[13px]">
            {c.text}
          </button>
        ))}
      </div>
    </div>
  );
}
