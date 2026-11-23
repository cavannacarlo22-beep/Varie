import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

/** null quando il database non è configurato: il sito mostra i dati dimostrativi. */
export const sql = url ? neon(url) : null;
export const hasDb = Boolean(url);
