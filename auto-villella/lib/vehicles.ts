import { sql } from "./db";
import { demoVehicles } from "./demo";
import type { Vehicle, VehicleFilters } from "./types";

function normalize(row: Record<string, unknown>): Vehicle {
  return {
    ...(row as unknown as Vehicle),
    features: (row.features as string[] | null) ?? [],
    images: (row.images as string[] | null) ?? [],
    created_at: new Date(row.created_at as string).toISOString(),
  };
}

/** Tutti i veicoli (i venduti solo se richiesti). Un concessionario ne ha al massimo qualche centinaio. */
export async function getVehicles(opts: { includeSold?: boolean } = {}): Promise<Vehicle[]> {
  let list: Vehicle[];
  if (sql) {
    const rows = await sql`SELECT * FROM vehicles ORDER BY created_at DESC`;
    list = rows.map(normalize);
  } else {
    list = demoVehicles;
  }
  return opts.includeSold ? list : list.filter((v) => v.status !== "venduto");
}

export async function getVehicleBySlug(slug: string) {
  if (sql) {
    const rows = await sql`SELECT * FROM vehicles WHERE slug = ${slug} LIMIT 1`;
    return rows[0] ? normalize(rows[0]) : null;
  }
  return demoVehicles.find((v) => v.slug === slug) ?? null;
}

export async function getVehicleById(id: number) {
  if (sql) {
    const rows = await sql`SELECT * FROM vehicles WHERE id = ${id} LIMIT 1`;
    return rows[0] ? normalize(rows[0]) : null;
  }
  return demoVehicles.find((v) => v.id === id) ?? null;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterVehicles(list: Vehicle[], f: VehicleFilters) {
  const words = f.q ? fold(f.q).split(/\s+/).filter(Boolean) : [];
  const out = list.filter((v) => {
    if (f.brand && v.brand !== f.brand) return false;
    if (f.fuel && v.fuel !== f.fuel) return false;
    if (f.gearbox && v.gearbox !== f.gearbox) return false;
    if (f.body && v.body !== f.body) return false;
    if (f.maxPrice && v.price > f.maxPrice) return false;
    if (f.maxKm && v.km > f.maxKm) return false;
    if (f.minYear && v.year < f.minYear) return false;
    if (words.length) {
      const hay = fold(`${v.brand} ${v.model} ${v.version ?? ""} ${v.color ?? ""}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const sorters: Record<string, (a: Vehicle, b: Vehicle) => number> = {
    "prezzo-asc": (a, b) => a.price - b.price,
    "prezzo-desc": (a, b) => b.price - a.price,
    "km-asc": (a, b) => a.km - b.km,
    "anno-desc": (a, b) => b.year - a.year,
    recenti: (a, b) => b.created_at.localeCompare(a.created_at),
  };
  return out.sort(sorters[f.sort ?? "recenti"] ?? sorters.recenti);
}

export function uniqueBrands(list: Vehicle[]) {
  return [...new Set(list.map((v) => v.brand))].sort((a, b) => a.localeCompare(b, "it"));
}
