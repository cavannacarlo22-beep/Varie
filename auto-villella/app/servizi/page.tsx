import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = { title: "Servizi", description: "Finanziamenti su misura, valutazione della permuta, garanzia fino a 36 mesi e gestione completa delle pratiche." };

const SERVICES = [
  { id: "finanziamento", title: "Finanziamento", lead: "Rate su misura, anche senza anticipo.", points: ["Durata da 12 a 84 mesi", "Esito in giornata nella maggior parte dei casi", "Formula con maxi-rata finale per cambiare auto prima", "Possibilità di estinzione anticipata"] },
  { id: "permuta", title: "Permuta e ritiro", lead: "La tua auto diventa il tuo anticipo.", points: ["Valutazione gratuita entro 24 ore lavorative", "Ritiriamo auto di ogni marca e età", "Pagamento immediato se vuoi solo vendere", "Ci occupiamo noi delle pratiche"] },
  { id: "garanzia", title: "Garanzia", lead: "12 mesi inclusi, fino a 36 se vuoi stare tranquillo.", points: ["Copertura su motore, cambio e impianto elettrico", "Assistenza in officine convenzionate in tutta Italia", "Soccorso stradale incluso nelle formule estese"] },
  { id: "pratiche", title: "Pratiche e consegna", lead: "Tu scegli l'auto, al resto pensiamo noi.", points: ["Passaggio di proprietà incluso", "Preventivi assicurativi dedicati", "Consegna a domicilio su richiesta", "Auto lavata, igienizzata e con il pieno"] },
];

export default function ServicesPage() {
  return (
    <>
      <PageHero eyebrow="Servizi" title="Tutto quello che serve, in un posto solo">
        Dal primo preventivo alle chiavi in mano: finanziamento, permuta, garanzia e pratiche gestiti da noi.
      </PageHero>
      <nav className="sticky top-18 z-30 bg-paper/95 backdrop-blur border-b border-line" aria-label="Servizi">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex gap-6 overflow-x-auto">
          {SERVICES.map((s) => <a key={s.id} href={`#${s.id}`} className="eyebrow py-4 whitespace-nowrap text-steel hover:text-ink">{s.title}</a>)}
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {SERVICES.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-36 py-16 border-b border-line grid gap-8 lg:grid-cols-[120px_1fr_1fr]">
            <span className="display text-6xl text-line tabular">0{i + 1}</span>
            <div>
              <h2 className="display text-4xl">{s.title}</h2>
              <p className="mt-4 text-xl text-steel">{s.lead}</p>
            </div>
            <ul className="space-y-3 lg:pt-2">
              {s.points.map((p) => <li key={p} className="flex gap-3"><span className="mt-2.5 h-0.5 w-4 bg-red shrink-0" />{p}</li>)}
            </ul>
          </section>
        ))}
      </div>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="display text-4xl">Hai una domanda?</h2>
          <p className="mt-4 text-steel text-lg">Scrivici e ti rispondiamo in giornata. Oppure <Link href="/veicoli" className="underline decoration-red underline-offset-4">guarda le auto disponibili</Link>.</p>
        </div>
        <div className="bg-white border border-line p-6 sm:p-8"><LeadForm variant="contact" /></div>
      </section>
    </>
  );
}
