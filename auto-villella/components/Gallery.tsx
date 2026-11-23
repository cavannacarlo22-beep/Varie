"use client";

import { useState } from "react";
import Image from "next/image";
import type { Vehicle } from "@/lib/types";
import { VehicleImage } from "./VehicleImage";

export function Gallery({ v }: { v: Vehicle }) {
  const [i, setI] = useState(0);
  const n = v.images.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <div>
      <div className="relative aspect-[16/10] bg-coal [container-type:inline-size] overflow-hidden">
        <VehicleImage v={v} src={v.images[i]} sizes="(min-width:1024px) 60vw, 100vw" priority />
        {n > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Foto precedente" className="absolute left-0 top-1/2 -translate-y-1/2 size-12 grid place-items-center bg-ink/70 text-white hover:bg-red">←</button>
            <button onClick={() => go(1)} aria-label="Foto successiva" className="absolute right-0 top-1/2 -translate-y-1/2 size-12 grid place-items-center bg-ink/70 text-white hover:bg-red">→</button>
            <span className="absolute bottom-3 right-3 eyebrow bg-ink/80 text-white px-2.5 py-1 tabular">{i + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-2 grid grid-cols-5 sm:grid-cols-6 gap-2">
          {v.images.map((src, k) => (
            <button key={src} onClick={() => setI(k)} aria-label={`Foto ${k + 1}`} className={`relative aspect-[4/3] overflow-hidden border-2 ${k === i ? "border-red" : "border-transparent opacity-70 hover:opacity-100"}`}>
              <Image src={src} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
