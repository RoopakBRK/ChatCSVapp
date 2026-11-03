import Link from "next/link";
import Logo from "./Logo";

const COLUMNS = [
  { title: "Product", links: [{ href: "/chat", label: "Open app" }, { href: "#features", label: "Features" }, { href: "#how", label: "How it works" }] },
  { title: "Help", links: [{ href: "#faq", label: "FAQ" }, { href: "#about", label: "About" }] },
];

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-white/70 bg-white/60 backdrop-blur">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted">Ask your CSV files questions in plain English and get answers you can check.</p>
          <p className="mt-4 text-xs text-muted">Built with FastAPI, DuckDB, Groq, Next.js and Plotly.</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("/") ? (
                    <Link href={l.href} className="text-sm text-muted hover:text-pink-600">{l.label}</Link>
                  ) : (
                    <a href={l.href} className="text-sm text-muted hover:text-pink-600">{l.label}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-white/70 py-5 text-center text-xs text-muted">© 2026 CSVChat</p>
    </footer>
  );
}
