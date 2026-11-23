// Crea le tabelle su Neon (se mancano) e, al primo avvio, inserisce i veicoli dimostrativi.
// Gira in automatico a ogni build su Vercel. Senza DATABASE_URL non fa nulla.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL assente: salto (il sito userà i dati dimostrativi).");
  process.exit(0);
}
const sql = neon(url);

await sql`CREATE TABLE IF NOT EXISTS vehicles (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  brand       TEXT NOT NULL,
  model       TEXT NOT NULL,
  version     TEXT,
  year        INTEGER NOT NULL,
  km          INTEGER NOT NULL DEFAULT 0,
  fuel        TEXT NOT NULL,
  gearbox     TEXT NOT NULL,
  power_cv    INTEGER,
  body        TEXT NOT NULL,
  color       TEXT,
  doors       INTEGER,
  seats       INTEGER,
  price       INTEGER NOT NULL,
  price_old   INTEGER,
  description TEXT,
  features    TEXT[] NOT NULL DEFAULT '{}',
  images      TEXT[] NOT NULL DEFAULT '{}',
  featured    BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'disponibile',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

await sql`CREATE TABLE IF NOT EXISTS leads (
  id            SERIAL PRIMARY KEY,
  vehicle_id    INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_label TEXT,
  kind          TEXT NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  message       TEXT,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

await sql`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT)`;

// I demo si inseriscono una sola volta: se li cancelli dal pannello non tornano.
const seeded = await sql`SELECT 1 FROM app_meta WHERE key = 'demo_seeded'`;
if (!seeded.length && process.env.SEED_DEMO !== "false") {
  const demo = JSON.parse(readFileSync(new URL("../data/demo-vehicles.json", import.meta.url), "utf8"));
  const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  for (const [i, v] of demo.entries()) {
    const slug = `${slugify(`${v.brand} ${v.model} ${v.year}`)}-demo${i + 1}`;
    await sql`INSERT INTO vehicles (slug, brand, model, version, year, km, fuel, gearbox, power_cv, body, color, doors, seats, price, price_old, description, features, featured)
      VALUES (${slug}, ${v.brand}, ${v.model}, ${v.version}, ${v.year}, ${v.km}, ${v.fuel}, ${v.gearbox}, ${v.power_cv}, ${v.body}, ${v.color}, ${v.doors}, ${v.seats}, ${v.price}, ${v.price_old}, ${v.description}, ${v.features}, ${v.featured})
      ON CONFLICT (slug) DO NOTHING`;
  }
  await sql`INSERT INTO app_meta (key, value) VALUES ('demo_seeded', now()::text)`;
  console.log(`[migrate] Inseriti ${demo.length} veicoli dimostrativi.`);
}
console.log("[migrate] Database pronto.");
