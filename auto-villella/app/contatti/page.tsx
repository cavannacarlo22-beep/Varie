import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { LeadForm } from "@/components/LeadForm";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contatti", description: "Indirizzo, orari e contatti di Auto Villella. Scrivici o passa in salone." };

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contatti" title="Parliamone" />
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-10">
          <div>
            <p className="eyebrow text-red">Salone</p>
            <p className="display text-2xl mt-3">{site.address}</p>
            <p className="text-steel">{site.city}</p>
          </div>
          <div>
            <p className="eyebrow text-red">Telefono e WhatsApp</p>
            <a href={site.phoneHref} className="display text-2xl mt-3 block tabular hover:text-red">{site.phone}</a>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener" className="text-steel underline underline-offset-4">Scrivici su WhatsApp</a>
          </div>
          <div>
            <p className="eyebrow text-red">Email</p>
            <a href={`mailto:${site.email}`} className="text-xl mt-3 block hover:text-red">{site.email}</a>
          </div>
          <div>
            <p className="eyebrow text-red">Orari</p>
            <table className="mt-3 text-sm"><tbody>
              {site.hours.map((h) => <tr key={h.days}><th className="text-left font-semibold pr-6 py-1">{h.days}</th><td className="tabular">{h.time}</td></tr>)}
            </tbody></table>
          </div>
        </div>
        <div className="bg-white border border-line p-6 sm:p-8">
          <p className="display text-3xl mb-6">Scrivici</p>
          <LeadForm variant="contact" />
        </div>
      </section>
      <section className="border-t border-line">
        <iframe
          title={`Mappa: ${site.name}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(site.mapsQuery)}&output=embed`}
          className="w-full h-[420px] grayscale contrast-125"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
    </>
  );
}
