import Image from "next/image";
import type { Vehicle } from "@/lib/types";

/** Prima foto del veicolo, oppure un segnaposto coordinato col marchio finché le foto non sono caricate. */
export function VehicleImage({ v, src, sizes, priority, className = "" }: { v: Pick<Vehicle, "brand" | "model" | "images">; src?: string; sizes: string; priority?: boolean; className?: string }) {
  const url = src ?? v.images[0];
  if (url) {
    return <Image src={url} alt={`${v.brand} ${v.model}`} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
  }
  return (
    <div className={`absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_80%_10%,#2a2a2e_0%,#121214_55%,#0b0b0c_100%)] ${className}`} aria-label={`${v.brand} ${v.model}, foto in arrivo`} role="img">
      <div className="absolute -right-[10%] top-[18%] h-[3px] w-[70%] -rotate-[18deg] bg-red/80" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="display text-[clamp(1.6rem,6cqw,2.6rem)] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.35)] truncate">{v.brand}</p>
        <p className="eyebrow text-mist/70 mt-2">Foto in arrivo</p>
      </div>
    </div>
  );
}
