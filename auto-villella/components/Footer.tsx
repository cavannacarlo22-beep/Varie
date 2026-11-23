"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { site } from "@/lib/site";

export function Footer() {
  const path = usePathname();
  if (path.startsWith("/admin")) return null;
  return (
    <footer className="bg-ink text-mist">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo className="h-14 w-auto" />
          <p className="mt-5 text-sm leading-relaxed">{site.tagline}</p>
        </div>
        <div>
          <p className="eyebrow text-white mb-4">Vieni a trovarci</p>
          <p className="text-sm leading-relaxed">{site.address}<br />{site.city}</p>
          <a className="inline-block mt-3 text-sm text-white underline underline-offset-4 decoration-red" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.mapsQuery)}`} target="_blank" rel="noopener">Indicazioni stradali</a>
        </div>
        <div>
          <p className="eyebrow text-white mb-4">Orari</p>
          <ul className="text-sm space-y-1.5">
            {site.hours.map((h) => (
              <li key={h.days}><span className="text-white">{h.days}</span><br />{h.time}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow text-white mb-4">Contatti</p>
          <ul className="text-sm space-y-2">
            <li><a className="hover:text-white tabular" href={site.phoneHref}>{site.phone}</a></li>
            <li><a className="hover:text-white" href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener">WhatsApp</a></li>
            <li><a className="hover:text-white" href={`mailto:${site.email}`}>{site.email}</a></li>
          </ul>
        </div>
      </div>
      <div className="signature text-white/25 mx-auto max-w-7xl" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-2 justify-between text-xs">
        <p>© {new Date().getFullYear()} {site.name} · {site.vat}</p>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/admin" className="hover:text-white">Area riservata</Link>
        </div>
      </div>
    </footer>
  );
}
