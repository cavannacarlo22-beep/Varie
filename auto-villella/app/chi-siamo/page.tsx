import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = { title: "Chi siamo", description: "Auto Villella: una concessionaria di auto usate dove ogni vettura è scelta e controllata personalmente." };

// ⚠️ Testi di esempio: da sostituire con la storia vera dell'attività.
export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="Chi siamo" title="Un nome di famiglia su ogni auto che vendiamo">
        Auto Villella nasce da una passione semplice: vendere auto che compreremmo anche noi.
      </PageHero>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 grid gap-12 lg:grid-cols-2">
        <div className="space-y-6 text-lg leading-relaxed">
          <p>Non siamo un grande gruppo e non vogliamo esserlo. Ogni auto in esposizione l&apos;abbiamo scelta una per una, ne conosciamo la storia e possiamo raccontartela.</p>
          <p>Prima di mettere un&apos;auto in vendita la facciamo controllare da cima a fondo. Se c&apos;è qualcosa da sistemare lo sistemiamo, se non ci convince non la vendiamo.</p>
          <p>Il nostro lavoro non finisce alla consegna: ci trovi qui per il tagliando, per un consiglio o quando sarà il momento di cambiare di nuovo.</p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line border border-line self-start">
          {[["100%", "auto controllate prima della vendita"], ["12 mesi", "di garanzia sempre inclusa"], ["24 h", "per valutare la tua permuta"], ["1", "interlocutore, dall'inizio alla fine"]].map(([n, t]) => (
            <div key={t} className="bg-white p-6">
              <p className="display text-4xl tabular">{n}</p>
              <p className="mt-2 text-steel text-sm">{t}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
          <p className="display text-3xl sm:text-4xl">Passa a trovarci in salone.</p>
          <Link href="/contatti" className="btn-red">Come arrivare</Link>
        </div>
      </section>
    </>
  );
}
