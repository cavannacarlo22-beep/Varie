import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVehicleBySlug, getVehicles } from "@/lib/vehicles";
import { formatKm, formatPrice, vehicleTitle } from "@/lib/format";
import { Gallery } from "@/components/Gallery";
import { LeadForm } from "@/components/LeadForm";
import { FinanceCalculator } from "@/components/FinanceCalculator";
import { VehicleCard, StatusBadge } from "@/components/VehicleCard";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await getVehicleBySlug((await params).slug);
  if (!v) return { title: "Auto non trovata" };
  const title = `${vehicleTitle(v)} ${v.version ?? ""} ${v.year}`.trim();
  return {
    title,
    description: `${title} · ${formatKm(v.km)} · ${v.fuel} · ${formatPrice(v.price)}. Garanzia inclusa, finanziamento e permuta.`,
    openGraph: v.images[0] ? { images: [v.images[0]] } : undefined,
  };
}

export default async function VehiclePage({ params }: Props) {
  const v = await getVehicleBySlug((await params).slug);
  if (!v) notFound();

  const all = await getVehicles();
  const similar = all.filter((o) => o.id !== v.id && (o.body === v.body || o.brand === v.brand)).slice(0, 3);
  const label = `${vehicleTitle(v)} ${v.version ?? ""} (${v.year})`.replace(/\s+/g, " ");
  const wa = `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(`Ciao, mi interessa la ${label} a ${formatPrice(v.price)}.`)}`;

  const specs: [string, string | null][] = [
    ["Anno", String(v.year)],
    ["Chilometri", formatKm(v.km)],
    ["Alimentazione", v.fuel],
    ["Cambio", v.gearbox],
    ["Potenza", v.power_cv ? `${v.power_cv} CV (${Math.round(v.power_cv * 0.7355)} kW)` : null],
    ["Carrozzeria", v.body],
    ["Colore", v.color],
    ["Porte", v.doors ? String(v.doors) : null],
    ["Posti", v.seats ? String(v.seats) : null],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: label,
    brand: { "@type": "Brand", name: v.brand },
    model: v.model,
    vehicleModelDate: String(v.year),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: v.km, unitCode: "KMT" },
    fuelType: v.fuel,
    image: v.images,
    offers: { "@type": "Offer", price: v.price, priceCurrency: "EUR", availability: v.status === "venduto" ? "https://schema.org/SoldOut" : "https://schema.org/InStock" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6">
        <nav className="text-sm text-steel" aria-label="Percorso">
          <Link href="/veicoli" className="hover:text-ink">Auto in vendita</Link> <span className="mx-1">/</span> <span className="text-ink">{vehicleTitle(v)}</span>
        </nav>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          <Gallery v={v} />

          <div className="mt-10">
            <h2 className="display text-3xl">Dati principali</h2>
            <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-px bg-line border border-line">
              {specs.filter(([, val]) => val).map(([k, val]) => (
                <div key={k} className="bg-white p-4">
                  <dt className="eyebrow text-steel text-[0.65rem]">{k}</dt>
                  <dd className="mt-1 font-semibold tabular">{val}</dd>
                </div>
              ))}
            </dl>
          </div>

          {v.features.length > 0 && (
            <div className="mt-10">
              <h2 className="display text-3xl">Equipaggiamento</h2>
              <ul className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {v.features.map((f) => <li key={f} className="flex gap-3"><span className="mt-2.5 h-0.5 w-3 bg-red shrink-0" />{f}</li>)}
              </ul>
            </div>
          )}

          {v.description && (
            <div className="mt-10">
              <h2 className="display text-3xl">Descrizione</h2>
              <p className="mt-6 text-lg leading-relaxed whitespace-pre-line max-w-3xl">{v.description}</p>
            </div>
          )}

          <div className="mt-10 grid sm:grid-cols-3 gap-px bg-line border border-line">
            {[["Garanzia 12 mesi", "estendibile fino a 36"], ["Check-up completo", "prima della consegna"], ["Passaggio incluso", "pensiamo a tutto noi"]].map(([a, b]) => (
              <div key={a} className="bg-ink text-white p-5"><p className="font-bold">{a}</p><p className="text-sm text-mist">{b}</p></div>
            ))}
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 self-start">
          <div className="bg-white border border-line p-6">
            <div className="flex items-center gap-2"><p className="eyebrow text-steel">{v.brand}</p><StatusBadge status={v.status} /></div>
            <h1 className="display text-4xl mt-2">{v.model}</h1>
            {v.version && <p className="mt-2 text-steel">{v.version}</p>}
            <div className="signature text-line my-6" />
            {v.price_old && v.price_old > v.price && <p className="text-steel line-through tabular">{formatPrice(v.price_old)}</p>}
            <p className="display text-5xl tabular">{formatPrice(v.price)}</p>
            <p className="text-xs text-steel mt-2">IVA esposta ove prevista · passaggio di proprietà incluso</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <a href={site.phoneHref} className="btn-dark">Chiama</a>
              <a href={wa} target="_blank" rel="noopener" className="btn bg-[#25D366] text-white hover:brightness-95">WhatsApp</a>
            </div>
          </div>
          <div className="bg-white border border-line p-6" id="richiesta">
            <p className="display text-2xl mb-5">Richiedi info</p>
            <LeadForm variant="vehicle" vehicleId={v.id} vehicleLabel={label} />
          </div>
          <FinanceCalculator price={v.price} />
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl mb-8">Potrebbero interessarti</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{similar.map((s) => <VehicleCard key={s.id} v={s} />)}</div>
        </section>
      )}
    </>
  );
}
