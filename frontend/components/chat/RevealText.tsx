"use client";

import { useEffect, useState } from "react";

/**
 * Shows text word by word over about a second. Off when `animate` is false (restored history)
 * or when the system asks for reduced motion.
 */
export default function RevealText({ text, animate, className }: { text: string; animate: boolean; className?: string }) {
  const words = text.split(/(\s+)/); // keep the spaces (and line breaks) as their own pieces
  const [shown, setShown] = useState(animate ? 0 : words.length);

  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setShown(words.length), 0);
      return () => clearTimeout(id);
    }
    const step = Math.max(12, 1000 / Math.max(1, words.length));
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= words.length) clearInterval(id);
        return Math.min(words.length, n + 1);
      });
    }, step);
    return () => clearInterval(id);
  }, [animate, words.length]);

  return (
    <p className={className} aria-label={text}>
      <span aria-hidden={shown < words.length}>{words.slice(0, shown).join("")}</span>
    </p>
  );
}
