// FILE: backend/src/db/sql.ts
//
// Helper per scrivere SQL parametrizzato.
//
// Il punto di questo file è che non esiste alcun modo di interpolare una
// stringa dentro una query. Il tag `sql` mette *sempre* i valori nell'array dei
// parametri e nel testo scrive `$1, $2, …`. Anche se qualcuno scrivesse
//
//     sql`SELECT * FROM users WHERE email = ${untrustedInput}`
//
// il valore finirebbe fra i parametri, non nel testo SQL: la SQL injection non
// è "evitata con attenzione", è strutturalmente impossibile.
//
// Le parti dinamiche legittime (nomi di colonna per l'ordinamento, per esempio)
// passano da `raw`, che è volutamente scomodo da usare e accetta solo valori
// presi da liste chiuse definite nel codice.

import type { QueryResultRow } from 'pg';
import { pool, type DbClient } from './pool.js';
import { translateDatabaseError } from '../utils/errors.js';

const RAW = Symbol('sql.raw');

export interface RawFragment {
  readonly [RAW]: true;
  readonly value: string;
}

/**
 * Inserisce testo SQL letterale.
 *
 * Da usare SOLO con costanti del codice o valori presi da una lista chiusa
 * (per esempio la direzione di un ORDER BY validata contro ['ASC','DESC']).
 * Non passare mai qui qualcosa che arriva da una richiesta HTTP.
 */
export function raw(value: string): RawFragment {
  return { [RAW]: true, value };
}

function isRaw(value: unknown): value is RawFragment {
  return typeof value === 'object' && value !== null && RAW in value;
}

export class SqlQuery {
  constructor(
    readonly text: string,
    readonly values: unknown[],
  ) {}
}

function isSqlQuery(value: unknown): value is SqlQuery {
  return value instanceof SqlQuery;
}

/**
 * Tag template per costruire una query.
 *
 * Supporta l'annidamento: `sql\`... ${sql\`AND x = ${1}\`}\`` rinumera
 * correttamente i parametri della parte annidata.
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
  let text = '';
  const params: unknown[] = [];

  strings.forEach((chunk, index) => {
    text += chunk;
    if (index >= values.length) return;

    const value = values[index];

    if (isRaw(value)) {
      text += value.value;
      return;
    }

    if (isSqlQuery(value)) {
      // Rinumera i placeholder della query annidata rispetto a quelli già usati.
      text += value.text.replace(/\$(\d+)/g, (_match, digits: string) => {
        return `$${params.length + Number.parseInt(digits, 10)}`;
      });
      params.push(...value.values);
      return;
    }

    params.push(value);
    text += `$${params.length}`;
  });

  return new SqlQuery(text, params);
}

/** Unisce più frammenti con un separatore (utile per WHERE dinamici). */
export function join(parts: SqlQuery[], separator: string): SqlQuery {
  if (parts.length === 0) return new SqlQuery('', []);

  let text = '';
  const params: unknown[] = [];

  parts.forEach((part, index) => {
    if (index > 0) text += separator;
    text += part.text.replace(/\$(\d+)/g, (_match, digits: string) => {
      return `$${params.length + Number.parseInt(digits, 10)}`;
    });
    params.push(...part.values);
  });

  return new SqlQuery(text, params);
}

export interface Queryable {
  query<R extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

function executor(client?: DbClient): Queryable {
  return (client ?? pool) as unknown as Queryable;
}

/** Esegue una query e restituisce tutte le righe. */
export async function queryRows<R extends QueryResultRow>(
  query: SqlQuery,
  client?: DbClient,
): Promise<R[]> {
  try {
    const result = await executor(client).query<R>(query.text, query.values);
    return result.rows;
  } catch (error) {
    throw translateDatabaseError(error) ?? error;
  }
}

/** Esegue una query e restituisce la prima riga, o undefined. */
export async function queryOne<R extends QueryResultRow>(
  query: SqlQuery,
  client?: DbClient,
): Promise<R | undefined> {
  const rows = await queryRows<R>(query, client);
  return rows[0];
}

/** Esegue una query che non restituisce righe, e riporta quante ne ha toccate. */
export async function execute(query: SqlQuery, client?: DbClient): Promise<number> {
  try {
    const result = await executor(client).query(query.text, query.values);
    return result.rowCount ?? 0;
  } catch (error) {
    throw translateDatabaseError(error) ?? error;
  }
}
