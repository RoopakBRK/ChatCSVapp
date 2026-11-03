"use client";

import { useEffect, useRef, useState } from "react";

/** Renders its children only once they come near the screen, then keeps them (charts are heavy). */
export default function LazyMount({ height, children }: { height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "300px" });
    io.observe(node);
    return () => io.disconnect();
  }, [visible]);
  return <div ref={ref} style={visible ? undefined : { minHeight: height }}>{visible ? children : null}</div>;
}
