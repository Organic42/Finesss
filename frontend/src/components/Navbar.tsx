"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
  { href: "/ml", label: "ML Insights" },
  { href: "/transactions", label: "Transactions" },
  { href: "/reports", label: "Reports" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 backdrop-blur-lg bg-slate-900/50 border-b border-white/10">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 via-sky-400 to-emerald-400 shadow-lg shadow-indigo-500/30" />
          <span className="font-semibold tracking-tight text-lg text-white">
            FinEase
          </span>
        </Link>
        <ul className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname?.startsWith(l.href));
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={
                    "px-3 py-2 text-sm rounded-xl transition-colors " +
                    (active
                      ? "bg-white/15 text-white border border-white/20"
                      : "text-slate-300 hover:text-white hover:bg-white/10")
                  }
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
