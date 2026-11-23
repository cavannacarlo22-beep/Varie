"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { endSession, isAdmin, startSession } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { STATUSES } from "@/lib/site";

async function guard() {
  if (!(await isAdmin())) redirect("/admin/login");
  if (!sql) throw new Error("Database non configurato");
  return sql;
}

export async function login(_prev: string | null, form: FormData) {
  const ok = await startSession(String(form.get("password") ?? ""));
  if (!ok) return "Password errata.";
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const intOrNull = (f: FormData, k: string) => {
  const v = str(f, k).replace(/[.\s€]/g, "");
  return v && /^\d+$/.test(v) ? Number(v) : null;
};
const lines = (f: FormData, k: string) => str(f, k).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

export type SaveState = { error?: string } | null;

export async function saveVehicle(_prev: SaveState, f: FormData): Promise<SaveState> {
  const db = await guard();
  const id = intOrNull(f, "id");
  const data = {
    brand: str(f, "brand"),
    model: str(f, "model"),
    version: str(f, "version") || null,
    year: intOrNull(f, "year"),
    km: intOrNull(f, "km") ?? 0,
    fuel: str(f, "fuel"),
    gearbox: str(f, "gearbox"),
    power_cv: intOrNull(f, "power_cv"),
    body: str(f, "body"),
    color: str(f, "color") || null,
    doors: intOrNull(f, "doors"),
    seats: intOrNull(f, "seats"),
    price: intOrNull(f, "price"),
    price_old: intOrNull(f, "price_old"),
    description: str(f, "description") || null,
    features: lines(f, "features"),
    images: lines(f, "images"),
    featured: f.get("featured") === "on",
    status: (STATUSES as readonly string[]).includes(str(f, "status")) ? str(f, "status") : "disponibile",
  };
  if (!data.brand || !data.model) return { error: "Marca e modello sono obbligatori." };
  if (!data.year || data.year < 1950 || data.year > 2100) return { error: "Anno non valido." };
  if (!data.price) return { error: "Inserisci il prezzo." };
  if (!data.fuel || !data.gearbox || !data.body) return { error: "Completa alimentazione, cambio e carrozzeria." };

  try {
    if (id) {
      await db`UPDATE vehicles SET brand=${data.brand}, model=${data.model}, version=${data.version}, year=${data.year}, km=${data.km},
        fuel=${data.fuel}, gearbox=${data.gearbox}, power_cv=${data.power_cv}, body=${data.body}, color=${data.color}, doors=${data.doors},
        seats=${data.seats}, price=${data.price}, price_old=${data.price_old}, description=${data.description}, features=${data.features},
        images=${data.images}, featured=${data.featured}, status=${data.status} WHERE id=${id}`;
    } else {
      const slug = `${slugify(`${data.brand} ${data.model} ${data.year}`)}-${Math.random().toString(36).slice(2, 7)}`;
      await db`INSERT INTO vehicles (slug, brand, model, version, year, km, fuel, gearbox, power_cv, body, color, doors, seats, price, price_old, description, features, images, featured, status)
        VALUES (${slug}, ${data.brand}, ${data.model}, ${data.version}, ${data.year}, ${data.km}, ${data.fuel}, ${data.gearbox}, ${data.power_cv}, ${data.body}, ${data.color},
        ${data.doors}, ${data.seats}, ${data.price}, ${data.price_old}, ${data.description}, ${data.features}, ${data.images}, ${data.featured}, ${data.status})`;
    }
  } catch (e) {
    console.error("saveVehicle", e);
    return { error: "Salvataggio non riuscito. Riprova." };
  }
  revalidatePath("/", "layout");
  redirect("/admin?salvato=1");
}

export async function setStatus(id: number, status: string) {
  const db = await guard();
  if (!(STATUSES as readonly string[]).includes(status)) return;
  await db`UPDATE vehicles SET status=${status} WHERE id=${id}`;
  revalidatePath("/", "layout");
}

export async function deleteVehicle(id: number) {
  const db = await guard();
  await db`DELETE FROM vehicles WHERE id=${id}`;
  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function toggleLeadRead(id: number, read: boolean) {
  const db = await guard();
  await db`UPDATE leads SET read=${read} WHERE id=${id}`;
  revalidatePath("/admin/richieste");
}

export async function deleteLead(id: number) {
  const db = await guard();
  await db`DELETE FROM leads WHERE id=${id}`;
  revalidatePath("/admin/richieste");
}
