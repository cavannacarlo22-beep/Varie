"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { site } from "@/lib/site";

const NAV = [
  { href: "/veicoli", label: "Auto in vendita" },
  { href: "/servizi", label: "Servizi" },
  { href: "/chi-siamo", label: "Chi siamo" },
  { href: "/contatti", label: "Contatti" },
];

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50 bg-ink/95 text-white backdrop-blur border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-18 flex items-center justify-between gap-6">
        <Logo className="h-10 sm:h-11 w-auto" />
        <nav className="hidden lg:flex items-center gap-8" aria-label="Principale">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} className={`eyebrow py-2 border-b-2 transition-colors ${active ? "border-red text-white" : "border-transparent text-mist hover:text-white"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <a href={site.phoneHref} className="eyebrow text-mist hover:text-white tabular">{site.phone}</a>
          <Link href="/veicoli" className="btn-red h-10">Trova la tua auto</Link>
        </div>
        <button className="lg:hidden p-2 -mr-2" aria-label={open ? "Chiudi menu" : "Apri menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav className="lg:hidden border-t border-white/10 px-4 pb-6" aria-label="Menu mobile">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="display block text-2xl py-4 border-b border-white/10">
              {n.label}
            </Link>
          ))}
          <a href={site.phoneHref} className="btn-red w-full mt-6">Chiama {site.phone}</a>
        </nav>
      )}
    </header>
  );
}
