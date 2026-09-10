// FILE: backend/src/db/pool.ts
//
// Connessione a Neon.
//
// Due note su Neon in particolare:
//
//  1. Neon richiede TLS. La stringa di connessione finisce con
//     `?sslmode=require`; qui impostiamo comunque `ssl` esplicitamente perché
//     `pg` non deduce sempre l'impostazione dalla query string.
//
//  2. Neon mette in pausa i database inattivi (piano gratuito). La prima query
//     dopo la pausa può metterci qualche secondo: per questo il
//     connectionTimeout è generoso, e per questo `withRetry` riprova una volta
//     sugli errori di connessione. Non è un workaround: è il comportamento
//     documentato del servizio.

import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const { Pool, types } = pg;

// DATE (OID 1082) arriva come stringa "2026-03-14" invece che come Date
// interpretata nel fuso del server. Una data di calendario non ha un fuso:
// trasformarla in Date introdurrebbe errori di un giorno.
types.setTypeParser(1082, (value: string) => value);

// NUMERIC (OID 1700) arriva come stringa per non perdere precisione.
// I prezzi della wishlist li convertiamo esplicitamente dove servono.
types.setTypeParser(1700, (value: string) => value);

// BIGINT (OID 20): i sync_seq stanno comodamente in un Number fino a 2^53,
// e un utente dovrebbe fare novemila miliardi di modifiche per avvicinarsi.
types.setTypeParser(20, (value: string) => Number.parseInt(value, 10));

/**
 * Decide la configurazione TLS e restituisce la stringa ripulita.
 *
 * Il punto delicato: `pg` legge il parametro `sslmode` *dentro* la stringa di
 * connessione e quello che ne ricava ha la precedenza sull'opzione `ssl`
 * passata qui sotto. Quindi la riga «se è localhost niente TLS» non bastava:
 * una stringa copiata da Neon e riusata in locale finiva comunque per provare
 * una connessione cifrata contro un PostgreSQL che non ne ha una, e falliva
 * con «self-signed certificate».
 *
 * Togliamo `sslmode` dalla stringa e decidiamo qui, in un posto solo. Come
 * effetto secondario il comportamento non cambierà quando `pg` 9 modificherà
 * il significato di `sslmode=require`: quel parametro non lo passiamo più.
 */
export function connessione(url: string): { stringa: string; ssl: false | { rejectUnauthorized: boolean } } {
  let indirizzo: URL;
  try {
    indirizzo = new URL(url);
  } catch {
    // Stringa non analizzabile: la passiamo com'è e lasciamo che sia `pg` a
    // dire cosa non va, con il suo messaggio che è più preciso del nostro.
    return { stringa: url, ssl: { rejectUnauthorized: true } };
  }

  // Per un indirizzo IPv6 `URL.hostname` conserva le parentesi quadre
  // («[::1]»), quindi vanno tolte prima di confrontare.
  const host = indirizzo.hostname.replace(/^\[|\]$/g, '');
  const inLocale = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  for (const parametro of ['sslmode', 'ssl', 'uselibpqcompat']) {
    indirizzo.searchParams.delete(parametro);
  }

  // In locale nessun TLS; ovunque altro TLS con verifica del certificato.
  // `rejectUnauthorized: false` non compare in questo file di proposito: è la
  // riga che trasforma una connessione cifrata in una connessione cifrata
  // *verso chiunque*, ed è il modo più comune di rendere inutile il TLS.
  return { stringa: indirizzo.toString(), ssl: inLocale ? false : { rejectUnauthorized: true } };
}

const { stringa: stringaConnessione, ssl } = connessione(config.database.url);

export const pool = new Pool({
  connectionString: stringaConnessione,
  ssl,
  max: config.database.maxConnections,
  idleTimeoutMillis: config.database.idleTimeoutMs,
  connectionTimeoutMillis: config.database.connectionTimeoutMs,
  // Una query che supera questo tempo viene annullata dal database stesso:
  // protegge il pool da query patologiche.
  statement_timeout: config.database.statementTimeoutMs,
  application_name: 'nina-backend',
});

pool.on('error', (error) => {
  // Un errore su una connessione inattiva non deve far cadere il processo.
  logger.error({ err: error }, 'Errore su una connessione inattiva del pool');
});

export type DbClient = pg.PoolClient;

/**
 * Esegue una funzione dentro una transazione, con COMMIT o ROLLBACK automatici.
 *
 * Tutte le operazioni che toccano più tabelle passano da qui: registrazione,
 * rotazione dei refresh token, push di sincronizzazione. Se qualcosa fallisce
 * a metà, il database resta coerente.
 */
export async function withTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error({ err: rollbackError }, 'ROLLBACK fallito');
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Verifica che il database risponda. Usata da /health e dallo script di setup. */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = Date.now();
  await pool.query('SELECT 1');
  return { ok: true, latencyMs: Date.now() - started };
}

export async function closePool(): Promise<void> {
  await pool.end();
}
