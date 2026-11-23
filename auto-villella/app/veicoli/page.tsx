import type { Metadata } from "next";
import Link from "next/link";
import { filterVehicles, getVehicles, uniqueBrands } from "@/lib/vehicles";
import { VehicleCard } from "@/components/VehicleCard";
import { BODIES, FUELS, GEARBOXES } from "@/lib/site";
import type { VehicleFilters } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auto in vendita", description: "Tutte le auto usate disponibili: filtra per marca, alimentazione, prezzo e chilometri." };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const int = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

function Select({ name, label, value, options }: { name: string; label: string; value?: string | number; options: (string | [string | number, string])[] }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="field">
        <option value="">Tutti</option>
        {options.map((o) => {
          const [val, text] = Array.isArray(o) ? o : [o, o];
          return <option key={val} value={val}>{text}</option>;
        })}
      </select>
    </label>
  );
}

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f: VehicleFilters = {
    q: one(sp.q),
    brand: one(sp.brand),
    fuel: one(sp.fuel),
    gearbox: one(sp.gearbox),
    body: one(sp.body),
    maxPrice: int(one(sp.maxPrice)),
    maxKm: int(one(sp.maxKm)),
    minYear: int(one(sp.minYear)),
    sort: one(sp.sort) as VehicleFilters["sort"],
  };
  const all = await getVehicles();
  const list = filterVehicles(all, f);
  const brands = uniqueBrands(all);
  const years = [...new Set(all.map((v) => v.year))].sort((a, b) => b - a);
  const active = Object.entries(f).filter(([k, v]) => v !== undefined && k !== "sort").length;

  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
          <p className="eyebrow text-mist">Parco auto</p>
          <h1 className="display text-5xl sm:text-7xl mt-3">Auto in vendita</h1>
          <div className="signature text-white/30 mt-8 max-w-md" />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid gap-10 lg:grid-cols-[280px_1fr]">
        <aside>
          <details className="lg:open group border border-line bg-white" open={active > 0 || undefined}>
            <summary className="lg:hidden flex items-center justify-between p-4 cursor-pointer eyebrow">
              Filtri {active > 0 && <span className="bg-red text-white px-2 py-0.5">{active}</span>}
              <span className="group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <form className="p-5 grid gap-5 lg:sticky lg:top-24" action="/veicoli">
              <label className="block">
                <span className="label">Cerca</span>
                <input name="q" defaultValue={f.q} placeholder="es. Golf automatica" className="field" />
              </label>
              <Select name="brand" label="Marca" value={f.brand} options={brands} />
              <Select name="body" label="Carrozzeria" value={f.body} options={[...BODIES]} />
              <Select name="fuel" label="Alimentazione" value={f.fuel} options={[...FUELS]} />
              <Select name="gearbox" label="Cambio" value={f.gearbox} options={[...GEARBOXES]} />
              <Select name="maxPrice" label="Prezzo massimo" value={f.maxPrice} options={[10000, 15000, 20000, 25000, 30000, 40000, 50000].map((p) => [p, `${p.toLocaleString("it-IT")} €`])} />
              <Select name="maxKm" label="Chilometri massimi" value={f.maxKm} options={[10000, 30000, 50000, 80000, 100000, 150000].map((k) => [k, `${k.toLocaleString("it-IT")} km`])} />
              <Select name="minYear" label="Anno minimo" value={f.minYear} options={years.map((y) => [y, `dal ${y}`])} />
              {f.sort && <input type="hidden" name="sort" value={f.sort} />}
              <button className="btn-red w-full">Applica filtri</button>
              {active > 0 && <Link href="/veicoli" className="text-center text-sm underline underline-offset-4">Azzera filtri</Link>}
            </form>
          </details>
        </aside>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <p className="text-steel"><b className="text-ink tabular">{list.length}</b> {list.length === 1 ? "auto trovata" : "auto trovate"}</p>
            <form action="/veicoli" className="flex items-center gap-2">
              {Object.entries(f).filter(([k, v]) => v !== undefined && k !== "sort").map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
              <label htmlFor="sort" className="text-sm text-steel">Ordina</label>
              <select id="sort" name="sort" defaultValue={f.sort ?? "recenti"} className="field h-10 w-auto">
                <option value="recenti">Più recenti</option>
                <option value="prezzo-asc">Prezzo crescente</option>
                <option value="prezzo-desc">Prezzo decrescente</option>
                <option value="km-asc">Meno chilometri</option>
                <option value="anno-desc">Più nuove</option>
              </select>
              <button className="btn-dark h-10 px-4">Ok</button>
            </form>
          </div>
          {list.length ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((v, i) => <VehicleCard key={v.id} v={v} priority={i < 3} />)}
            </div>
          ) : (
            <div className="border border-dashed border-steel/40 p-12 text-center">
              <p className="display text-2xl">Nessuna auto con questi filtri</p>
              <p className="mt-3 text-steel">Prova ad allargare la ricerca, oppure dicci cosa cerchi: la troviamo noi.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/veicoli" className="btn-dark">Vedi tutte</Link>
                <Link href="/contatti" className="btn border border-ink hover:bg-ink hover:text-white">Cercala per me</Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
