"use client";

import { useState } from "react";
import { formatPrice, monthlyPayment } from "@/lib/format";

const DURATIONS = [24, 36, 48, 60, 72, 84];
const TAN = 7.9; // tasso indicativo, da aggiornare con l'offerta della finanziaria

export function FinanceCalculator({ price }: { price: number }) {
  const [down, setDown] = useState(Math.round((price * 0.2) / 500) * 500);
  const [months, setMonths] = useState(60);
  const rate = monthlyPayment(Math.max(price - down, 0), TAN, months);

  return (
    <div className="bg-white border border-line p-6">
      <p className="eyebrow text-red">Simula la rata</p>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="display text-5xl tabular">{formatPrice(Math.round(rate))}</span>
        <span className="text-steel">/ mese</span>
      </p>
      <label className="block mt-6">
        <span className="label flex justify-between"><span>Anticipo</span><span className="text-ink tabular">{formatPrice(down)}</span></span>
        <input type="range" min={0} max={Math.round(price * 0.6)} step={500} value={down} onChange={(e) => setDown(Number(e.target.value))} className="w-full accent-red" />
      </label>
      <fieldset className="mt-5">
        <legend className="label">Durata (mesi)</legend>
        <div className="grid grid-cols-6 gap-1">
          {DURATIONS.map((d) => (
            <button key={d} type="button" onClick={() => setMonths(d)} aria-pressed={months === d} className={`h-10 text-sm font-semibold tabular border ${months === d ? "bg-ink text-white border-ink" : "border-line hover:border-ink"}`}>{d}</button>
          ))}
        </div>
      </fieldset>
      <p className="mt-5 text-xs text-steel leading-relaxed">
        Simulazione indicativa con TAN {TAN.toLocaleString("it-IT")}% fisso, spese escluse. Non costituisce offerta: la proposta definitiva dipende dalla valutazione della finanziaria.
      </p>
    </div>
  );
}
