"use client";

import { useRef, useState } from "react";
import { EFFORTS, useEffort } from "@/hooks/useEffort";

/** A small pill in the question box: Low / Medium / High effort for the next questions. */
export default function EffortMenu({ disabled }: { disabled?: boolean }) {
  const { effort, setEffort } = useEffort();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const current = EFFORTS.find((e) => e.value === effort) ?? EFFORTS[1];
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation(); // close this menu only, not results too
          close();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Effort: ${current.label}`}
        title="How hard the AI thinks before writing the query"
        onClick={() => setOpen(!open)}
        className="flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-ui font-medium text-muted transition-colors hover:bg-hover hover:text-foreground disabled:opacity-50"
      >
        {current.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" aria-label="Effort" className="depth-2 absolute bottom-12 right-0 z-40 w-72 rounded-lg border border-border bg-card p-2">
            <p className="px-3 pb-1 pt-1 text-ui font-semibold">Effort</p>
            {EFFORTS.map((e, i) => {
              const on = e.value === effort;
              return (
                <button
                  key={e.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  autoFocus={on}
                  onClick={() => {
                    setEffort(e.value);
                    close();
                  }}
                  onKeyDown={(k) => {
                    if (k.key === "ArrowDown" || k.key === "ArrowUp") {
                      k.preventDefault();
                      const items = k.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]");
                      items?.[(i + (k.key === "ArrowDown" ? 1 : EFFORTS.length - 1)) % EFFORTS.length]?.focus();
                    }
                  }}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${on ? "bg-accent-soft" : "hover:bg-hover"}`}
                >
                  <span className="mt-1 w-4 shrink-0 text-accent-ink" aria-hidden>
                    {on && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  <span>
                    <span className="block text-ui font-medium text-foreground">{e.label}</span>
                    <span className="block text-ui text-muted">{e.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
