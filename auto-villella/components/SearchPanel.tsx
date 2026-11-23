import { FUELS } from "@/lib/site";

export function SearchPanel({ brands }: { brands: string[] }) {
  return (
    <form action="/veicoli" className="grid gap-px bg-graphite sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] border border-graphite">
      <label className="bg-coal px-4 py-3">
        <span className="eyebrow text-mist text-[0.65rem]">Marca</span>
        <select name="brand" className="mt-1 w-full bg-transparent text-white text-base font-medium focus:outline-none [&>option]:text-ink">
          <option value="">Tutte</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      <label className="bg-coal px-4 py-3">
        <span className="eyebrow text-mist text-[0.65rem]">Alimentazione</span>
        <select name="fuel" className="mt-1 w-full bg-transparent text-white text-base font-medium focus:outline-none [&>option]:text-ink">
          <option value="">Tutte</option>
          {FUELS.map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
      <label className="bg-coal px-4 py-3">
        <span className="eyebrow text-mist text-[0.65rem]">Budget massimo</span>
        <select name="maxPrice" className="mt-1 w-full bg-transparent text-white text-base font-medium focus:outline-none [&>option]:text-ink">
          <option value="">Qualsiasi</option>
          {[10000, 15000, 20000, 25000, 30000, 40000].map((p) => <option key={p} value={p}>fino a {p.toLocaleString("it-IT")} €</option>)}
        </select>
      </label>
      <button className="btn-red h-auto min-h-14 px-8 sm:col-span-2 lg:col-span-1">Cerca</button>
    </form>
  );
}
