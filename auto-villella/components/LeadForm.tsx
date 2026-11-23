"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitLead, type LeadState } from "@/app/actions";

type Variant = "vehicle" | "contact" | "sell";

const VEHICLE_KINDS = [
  ["informazioni", "Informazioni"],
  ["test-drive", "Prova su strada"],
  ["finanziamento", "Finanziamento"],
  ["permuta", "Permuta"],
] as const;

export function LeadForm({ variant, vehicleId, vehicleLabel, dark = false }: { variant: Variant; vehicleId?: number; vehicleLabel?: string; dark?: boolean }) {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead, null);
  const field = dark ? "field-dark" : "field";
  const label = dark ? "label text-mist" : "label";

  if (state?.ok) {
    return (
      <div className={`p-6 border-l-4 border-red ${dark ? "bg-coal text-white" : "bg-white"}`} role="status">
        <p className="display text-2xl">Fatto.</p>
        <p className="mt-2 text-sm">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      {vehicleId && <input type="hidden" name="vehicle_id" value={vehicleId} />}
      {vehicleLabel && <input type="hidden" name="vehicle_label" value={vehicleLabel} />}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {variant === "vehicle" && (
        <fieldset>
          <legend className={label}>Cosa ti interessa</legend>
          <div className="grid grid-cols-2 gap-2">
            {VEHICLE_KINDS.map(([value, text], i) => (
              <label key={value} className="relative cursor-pointer">
                <input type="radio" name="kind" value={value} defaultChecked={i === 0} className="peer sr-only" />
                <span className="flex h-11 items-center justify-center border border-line bg-white text-sm font-medium peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-red">{text}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {variant === "contact" && <input type="hidden" name="kind" value="contatto" />}
      {variant === "sell" && (
        <>
          <input type="hidden" name="kind" value="vendi" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className={label} htmlFor="car_model">La tua auto</label>
              <input id="car_model" name="car_model" className={field} placeholder="Marca, modello e versione" />
            </div>
            <div>
              <label className={label} htmlFor="car_year">Anno</label>
              <input id="car_year" name="car_year" inputMode="numeric" className={field} placeholder="2019" />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="car_km">Chilometri</label>
              <input id="car_km" name="car_km" inputMode="numeric" className={field} placeholder="85.000" />
            </div>
          </div>
        </>
      )}

      <div>
        <label className={label} htmlFor={`name-${variant}`}>Nome e cognome</label>
        <input id={`name-${variant}`} name="name" required autoComplete="name" className={field} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`phone-${variant}`}>Telefono</label>
          <input id={`phone-${variant}`} name="phone" type="tel" autoComplete="tel" className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`email-${variant}`}>Email</label>
          <input id={`email-${variant}`} name="email" type="email" autoComplete="email" className={field} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor={`message-${variant}`}>Messaggio <span className="normal-case tracking-normal font-normal">(facoltativo)</span></label>
        <textarea id={`message-${variant}`} name="message" rows={3} className={`${field} h-auto py-3`} />
      </div>
      <label className={`flex gap-3 text-xs leading-relaxed ${dark ? "text-mist" : "text-steel"}`}>
        <input type="checkbox" name="privacy" className="mt-0.5 size-4 accent-red shrink-0" />
        <span>Acconsento al trattamento dei dati per essere ricontattato, come descritto nell&apos;<Link href="/privacy" className="underline">informativa privacy</Link>.</span>
      </label>
      {state && !state.ok && <p className="text-sm font-medium text-red" role="alert">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-red w-full">
        {pending ? "Invio…" : variant === "sell" ? "Richiedi la valutazione" : "Invia richiesta"}
      </button>
    </form>
  );
}
