// FILE: backend/src/repositories/crudRepository.ts
//
// CRUD generico per le entità sincronizzabili, guidato dal registro in
// entities.ts. Le rotte REST si appoggiano qui invece di ripetere nove volte
// lo stesso SELECT/INSERT/UPDATE.
//
// Tutte le query filtrano per `user_id` preso dal token: non esiste un percorso
// che legga o scriva i dati di un altro utente, nemmeno sbagliando l'id.

import type { DbClient } from '../db/pool.js';
import { execute, join, queryOne, queryRows, raw, sql, type SqlQuery } from '../db/sql.js';
import { AppError } from '../utils/errors.js';
import type { SyncEntity } from '../types/domain.js';
import { ENTITIES, fieldByApiName, orderBy, rowToApi, selectList, tableName } from './entities.js';

type Row = Record<string, unknown>;
export type ApiObject = Record<string, unknown>;

export interface ListOptions {
  includeDeleted?: boolean;
  extraConditions?: SqlQuery[];
  limit?: number;
  offset?: number;
  orderOverride?: string;
}

export async function listForUser(
  entity: SyncEntity,
  userId: string,
  options: ListOptions = {},
  client?: DbClient,
): Promise<ApiObject[]> {
  const conditions: SqlQuery[] = [sql`user_id = ${userId}`];

  if (!options.includeDeleted && ENTITIES[entity].softDeletable) {
    conditions.push(sql`deleted_at IS NULL`);
  }
  if (options.extraConditions) {
    conditions.push(...options.extraConditions);
  }

  const where = join(conditions, ' AND ');
  const order = options.orderOverride ? raw(options.orderOverride) : orderBy(entity);
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows = await queryRows<Row>(
    sql`SELECT ${selectList(entity)}
          FROM ${tableName(entity)}
         WHERE ${where}
         ORDER BY ${order}
         LIMIT ${limit} OFFSET ${offset}`,
    client,
  );

  return rows.map((row) => rowToApi(entity, row));
}

export async function findById(
  entity: SyncEntity,
  userId: string,
  id: string,
  client?: DbClient,
): Promise<ApiObject | undefined> {
  const row = await queryOne<Row>(
    sql`SELECT ${selectList(entity)}
          FROM ${tableName(entity)}
         WHERE id = ${id} AND user_id = ${userId}`,
    client,
  );
  return row ? rowToApi(entity, row) : undefined;
}

export async function requireById(
  entity: SyncEntity,
  userId: string,
  id: string,
  client?: DbClient,
): Promise<ApiObject> {
  const found = await findById(entity, userId, id, client);
  if (!found || found['deletedAt'] !== null) {
    throw AppError.notFound(`Non abbiamo trovato questo elemento fra le tue ${ENTITIES[entity].label}.`);
  }
  return found;
}

/**
 * Traduce i campi in arrivo dalle API (camelCase) in colonne.
 * I campi sconosciuti o non scrivibili vengono ignorati in silenzio: il client
 * potrebbe essere una versione più nuova o più vecchia dell'app.
 */
function toColumns(
  entity: SyncEntity,
  input: ApiObject,
): { columns: string[]; values: unknown[] } {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(input)) {
    const field = fieldByApiName(entity, key);
    if (!field) continue;
    if (value === undefined) continue;
    columns.push(field.db);
    values.push(value);
  }

  return { columns, values };
}

export async function create(
  entity: SyncEntity,
  userId: string,
  deviceId: string | null,
  input: ApiObject,
  client?: DbClient,
): Promise<ApiObject> {
  const { columns, values } = toColumns(entity, input);

  const columnList = ['user_id', 'client_updated_at', 'last_device_id', ...columns];
  const valueList: SqlQuery[] = [
    sql`${userId}`,
    sql`${(input['clientUpdatedAt'] as string | undefined) ?? new Date().toISOString()}`,
    sql`${deviceId}`,
    ...values.map((value) => sql`${value}`),
  ];

  // L'id può arrivare dal client: l'app crea gli elementi anche offline e ne
  // genera già l'UUID, così l'elemento ha la stessa identità prima e dopo la
  // sincronizzazione.
  const providedId = typeof input['id'] === 'string' ? (input['id'] as string) : undefined;
  if (providedId) {
    columnList.unshift('id');
    valueList.unshift(sql`${providedId}`);
  }

  const row = await queryOne<Row>(
    sql`INSERT INTO ${tableName(entity)} (${raw(columnList.join(', '))})
        VALUES (${join(valueList, ', ')})
        RETURNING ${selectList(entity)}`,
    client,
  );

  if (!row) throw AppError.internal();
  return rowToApi(entity, row);
}

export async function update(
  entity: SyncEntity,
  userId: string,
  deviceId: string | null,
  id: string,
  input: ApiObject,
  client?: DbClient,
): Promise<ApiObject> {
  const { columns, values } = toColumns(entity, input);

  if (columns.length === 0) {
    return requireById(entity, userId, id, client);
  }

  const assignments: SqlQuery[] = columns.map((column, index) =>
    sql`${raw(column)} = ${values[index]}`,
  );
  assignments.push(
    sql`client_updated_at = ${(input['clientUpdatedAt'] as string | undefined) ?? new Date().toISOString()}`,
  );
  assignments.push(sql`last_device_id = ${deviceId}`);

  const row = await queryOne<Row>(
    sql`UPDATE ${tableName(entity)}
           SET ${join(assignments, ', ')}
         WHERE id = ${id} AND user_id = ${userId}
        RETURNING ${selectList(entity)}`,
    client,
  );

  if (!row) {
    throw AppError.notFound(`Non abbiamo trovato questo elemento fra le tue ${ENTITIES[entity].label}.`);
  }
  return rowToApi(entity, row);
}

/**
 * Cancellazione logica.
 *
 * Non si usa DELETE perché gli altri dispositivi devono poter *scoprire* che
 * l'elemento è stato cancellato: una riga sparita non genererebbe nessun
 * sync_seq e resterebbe visibile sull'iPad per sempre.
 */
export async function softDelete(
  entity: SyncEntity,
  userId: string,
  deviceId: string | null,
  id: string,
  client?: DbClient,
): Promise<ApiObject> {
  if (!ENTITIES[entity].softDeletable) {
    throw AppError.validation('Questo elemento non si può eliminare.');
  }

  const row = await queryOne<Row>(
    sql`UPDATE ${tableName(entity)}
           SET deleted_at        = COALESCE(deleted_at, now()),
               client_updated_at = ${new Date().toISOString()},
               last_device_id    = ${deviceId}
         WHERE id = ${id} AND user_id = ${userId}
        RETURNING ${selectList(entity)}`,
    client,
  );

  if (!row) {
    throw AppError.notFound(`Non abbiamo trovato questo elemento fra le tue ${ENTITIES[entity].label}.`);
  }
  return rowToApi(entity, row);
}

/** Elimina definitivamente le righe cancellate da più di 90 giorni. */
export async function purgeDeleted(entity: SyncEntity, client?: DbClient): Promise<number> {
  if (!ENTITIES[entity].softDeletable) return 0;
  return execute(
    sql`DELETE FROM ${tableName(entity)}
         WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '90 days'`,
    client,
  );
}
