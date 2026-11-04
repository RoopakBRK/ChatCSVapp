import type { NextConfig } from "next";

// Tailwind runs through PostCSS (postcss.config.mjs), the standard Tailwind v4 setup for Next.js.
// It used to run as a Turbopack loader (@tailwindcss/turbopack), which sometimes kept serving an old
// stylesheet after quick successive saves of globals.css (see devlog.md, entry 22).
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
