"use server";

import { sql } from "@/lib/db";

export type LeadState = { ok: boolean; message: string } | null;

const KINDS = new Set(["informazioni", "test-drive", "permuta", "finanziamento", "contatto", "vendi"]);

const clean = (v: FormDataEntryValue | null, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function submitLead(_prev: LeadState, form: FormData): Promise<LeadState> {
  // Campo trappola per i bot: gli utenti veri non lo vedono.
  if (clean(form.get("company"))) return { ok: true, message: "Richiesta inviata." };

  const name = clean(form.get("name"), 120);
  const email = clean(form.get("email"), 200);
  const phone = clean(form.get("phone"), 40);
  const kind = KINDS.has(clean(form.get("kind"))) ? clean(form.get("kind")) : "contatto";
  let message = clean(form.get("message"));
  const vehicleId = Number(form.get("vehicle_id")) || null;
  const vehicleLabel = clean(form.get("vehicle_label"), 200) || null;

  const extra = [
    ["Auto", clean(form.get("car_model"), 120)],
    ["Anno", clean(form.get("car_year"), 10)],
    ["Km", clean(form.get("car_km"), 20)],
  ].filter(([, v]) => v);
  if (extra.length) message = `${extra.map(([k, v]) => `${k}: ${v}`).join(" · ")}${message ? `\n\n${message}` : ""}`;

  if (name.length < 2) return { ok: false, message: "Scrivi il tuo nome." };
  if (!email && !phone) return { ok: false, message: "Lasciaci almeno un telefono o un'email per risponderti." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "L'indirizzo email non sembra corretto." };
  if (form.get("privacy") !== "on") return { ok: false, message: "Serve il consenso al trattamento dei dati." };

  if (!sql) {
    return { ok: true, message: "Richiesta ricevuta (modalità dimostrativa: database non ancora collegato)." };
  }
  try {
    await sql`INSERT INTO leads (vehicle_id, vehicle_label, kind, name, email, phone, message)
      VALUES (${vehicleId}, ${vehicleLabel}, ${kind}, ${name}, ${email || null}, ${phone || null}, ${message || null})`;
  } catch (e) {
    console.error("submitLead", e);
    return { ok: false, message: "Non siamo riusciti a inviare la richiesta. Riprova o chiamaci." };
  }
  return { ok: true, message: "Grazie! Ti ricontattiamo al più presto." };
}
