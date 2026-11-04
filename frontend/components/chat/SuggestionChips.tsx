type Chip = { text: string; onClick: () => void };

export default function SuggestionChips({ chips }: { chips: Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c.text} onClick={c.onClick} className="chip whitespace-normal text-left">
            {c.text}
          </button>
        ))}
    </div>
  );
}
