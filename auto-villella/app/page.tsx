import Link from "next/link";
import { getVehicles, uniqueBrands } from "@/lib/vehicles";
import { VehicleCard } from "@/components/VehicleCard";
import { SearchPanel } from "@/components/SearchPanel";
import { LeadForm } from "@/components/LeadForm";
import { BODIES, site } from "@/lib/site";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Selezione", "Compriamo solo auto di cui conosciamo la storia: chilometri certificati, tagliandi documentati, niente incidenti gravi."],
  ["Controllo", "Ogni vettura passa un check-up meccanico ed elettronico completo prima di entrare in esposizione."],
  ["Garanzia", "Garanzia di 12 mesi inclusa, estendibile fino a 36. Se qualcosa non va, ce ne occupiamo noi."],
  ["Consegna", "Passaggio di proprietà, assicurazione e consegna: pensiamo a tutto, tu firmi e parti."],
];

export default async function Home() {
  const all = await getVehicles();
  const featured = [...all.filter((v) => v.featured), ...all.filter((v) => !v.featured)].slice(0, 6);
  const brands = uniqueBrands(all);
  const bodies = BODIES.map((b) => ({ name: b, count: all.filter((v) => v.body === b).length })).filter((b) => b.count > 0);

  return (
    <>
      {/* HERO */}
      <section className="relative bg-ink text-white cut-bottom pb-[8vw]">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute right-[-15%] top-[8%] h-[2px] w-[75%] -rotate-[20deg] bg-gradient-to-r from-transparent via-red to-red" />
          <div className="absolute right-[-15%] top-[14%] h-px w-[60%] -rotate-[20deg] bg-gradient-to-r from-transparent to-white/20" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24">
          <p className="eyebrow text-mist">Auto usate selezionate · Garanzia inclusa</p>
          <h1 className="display mt-6 text-[clamp(2.75rem,9vw,7.5rem)]">
            Scegli.<br />Prova.<br /><span className="text-red">Parti.</span>
          </h1>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <p className="max-w-xl text-lg text-mist leading-relaxed">
              Ogni auto che vendiamo l&apos;abbiamo scelta e controllata noi. Prezzo chiaro, garanzia scritta e un finanziamento costruito sulle tue esigenze.
            </p>
            <div className="flex items-baseline gap-4 lg:text-right">
              <span className="display text-6xl sm:text-7xl tabular">{all.length}</span>
              <span className="eyebrow text-mist">auto pronte<br />alla consegna</span>
            </div>
          </div>
          <div className="mt-12"><SearchPanel brands={brands} /></div>
        </div>
      </section>

      {/* IN VETRINA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <p className="eyebrow text-red">In vetrina</p>
            <h2 className="display text-4xl sm:text-5xl mt-3">Arrivate da poco</h2>
          </div>
          <Link href="/veicoli" className="hidden sm:inline-flex btn-dark">Tutte le auto</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((v, i) => <VehicleCard key={v.id} v={v} priority={i < 3} />)}
        </div>
        <Link href="/veicoli" className="sm:hidden btn-dark w-full mt-8">Tutte le auto</Link>
      </section>

      {/* PER CARROZZERIA */}
      {bodies.length > 1 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line">
            {bodies.map((b) => (
              <Link key={b.name} href={`/veicoli?body=${encodeURIComponent(b.name)}`} className="group bg-paper hover:bg-ink hover:text-white transition-colors p-6 flex flex-col justify-between min-h-32">
                <span className="display text-2xl">{b.name}</span>
                <span className="eyebrow text-steel group-hover:text-mist mt-4">{b.count} {b.count === 1 ? "auto" : "auto"} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* METODO */}
      <section className="bg-white border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <p className="eyebrow text-red">Il nostro metodo</p>
          <h2 className="display text-4xl sm:text-5xl mt-3 max-w-3xl">Quattro passaggi, nessuna sorpresa</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="relative pt-8 border-t-2 border-ink">
                <span className="absolute -top-px left-0 h-0.5 w-12 bg-red" aria-hidden />
                <span className="display text-5xl text-line tabular">0{i + 1}</span>
                <h3 className="display text-2xl mt-3">{title}</h3>
                <p className="mt-3 text-steel leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* VENDI / PERMUTA */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-red">Vendi o permuta</p>
            <h2 className="display text-4xl sm:text-6xl mt-3">La tua auto vale più di quanto pensi</h2>
            <p className="mt-6 text-mist text-lg leading-relaxed max-w-lg">
              Raccontaci com&apos;è la tua auto: ti diamo una valutazione entro 24 ore lavorative. Puoi usarla come anticipo o vendercela direttamente, con pagamento immediato.
            </p>
            <ul className="mt-8 space-y-3 text-mist">
              {["Valutazione gratuita e senza impegno", "Pagamento sicuro alla firma", "Pensiamo noi al passaggio di proprietà"].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-2.5 h-0.5 w-4 bg-red shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="bg-coal p-6 sm:p-8 border border-graphite">
            <LeadForm variant="sell" dark />
          </div>
        </div>
      </section>

      {/* CONTATTI RAPIDI */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 grid gap-8 md:grid-cols-3">
        <div>
          <p className="eyebrow text-red">Passa in salone</p>
          <p className="display text-2xl mt-3">{site.address}</p>
          <p className="text-steel mt-1">{site.city}</p>
        </div>
        <div>
          <p className="eyebrow text-red">Siamo aperti</p>
          <ul className="mt-3 space-y-1 text-sm">{site.hours.map((h) => <li key={h.days}><b>{h.days}</b> · {h.time}</li>)}</ul>
        </div>
        <div className="flex flex-col gap-3 md:items-end md:justify-center">
          <a href={site.phoneHref} className="btn-dark w-full md:w-auto">Chiama ora</a>
          <Link href="/contatti" className="btn border border-ink w-full md:w-auto hover:bg-ink hover:text-white">Scrivici</Link>
        </div>
      </section>
    </>
  );
}
