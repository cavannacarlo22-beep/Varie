import Link from "next/link";
import type { Vehicle } from "@/lib/types";
import { formatKm, formatPrice } from "@/lib/format";
import { VehicleImage } from "./VehicleImage";

export function StatusBadge({ status }: { status: Vehicle["status"] }) {
  if (status === "disponibile") return null;
  return (
    <span className={`eyebrow px-2.5 py-1 text-[0.65rem] ${status === "riservato" ? "bg-amber-400 text-ink" : "bg-ink text-white"}`}>
      {status === "riservato" ? "Riservata" : "Venduta"}
    </span>
  );
}

export function VehicleCard({ v, priority }: { v: Vehicle; priority?: boolean }) {
  return (
    <Link href={`/veicoli/${v.slug}`} className="group flex flex-col bg-white border border-line hover:border-ink transition-colors">
      <div className="relative aspect-[4/3] bg-coal [container-type:inline-size] overflow-hidden">
        <VehicleImage v={v} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" priority={priority} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3 flex gap-2">
          <StatusBadge status={v.status} />
          {v.price_old && v.price_old > v.price && <span className="eyebrow px-2.5 py-1 text-[0.65rem] bg-red text-white">Prezzo ribassato</span>}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <p className="eyebrow text-steel">{v.brand}</p>
        <h3 className="mt-1 text-xl font-bold leading-tight" style={{ fontStretch: "112%" }}>{v.model}</h3>
        {v.version && <p className="mt-1 text-sm text-steel line-clamp-1">{v.version}</p>}
        <dl className="mt-4 grid grid-cols-3 gap-px bg-line border border-line text-center text-xs">
          {[
            ["Anno", String(v.year)],
            ["Km", formatKm(v.km).replace(" km", "")],
            ["Motore", v.fuel],
          ].map(([k, val]) => (
            <div key={k} className="bg-white py-2.5">
              <dt className="text-steel">{k}</dt>
              <dd className="font-semibold tabular mt-0.5 truncate px-1">{val}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto pt-5 flex items-end justify-between gap-3">
          <div>
            {v.price_old && v.price_old > v.price && <p className="text-sm text-steel line-through tabular">{formatPrice(v.price_old)}</p>}
            <p className="text-2xl font-extrabold tabular" style={{ fontStretch: "112%" }}>{formatPrice(v.price)}</p>
          </div>
          <span className="eyebrow text-red flex items-center gap-1 group-hover:gap-2 transition-all">Scheda <span aria-hidden>→</span></span>
        </div>
      </div>
    </Link>
  );
}
