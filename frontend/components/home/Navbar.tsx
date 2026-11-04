import Link from "next/link";
import LoginButton from "./LoginButton";
import Logo from "./Logo";

const LINKS = [
  { href: "#about", label: "About" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-panel/70 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" aria-label="CSVChat home">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-accent-soft hover:text-foreground">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <LoginButton />
        </div>
      </nav>
    </header>
  );
}
