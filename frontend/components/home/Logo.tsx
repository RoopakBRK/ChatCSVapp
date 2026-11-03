/** The CSVChat mark: a small gradient tile with chart bars, plus the name. */
export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  return (
    <span className="flex items-center gap-2">
      <span className={`btn-accent depth flex ${box} items-center justify-center rounded-xl text-white`} aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 18V11M12 18V6M18 18v-4" />
        </svg>
      </span>
      <span className={`font-bold tracking-tight ${size === "lg" ? "text-xl" : "text-lg"}`}>
        <span className="text-gradient-accent">CSVChat</span>
      </span>
    </span>
  );
}
