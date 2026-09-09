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

export const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.url.includes('localhost') || config.database.url.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: true },
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
