// FILE: backend/src/repositories/syncRepository.ts
//
// Il motore di sincronizzazione.
//
// Lettura (pull): "dammi tutto ciò che è cambiato dopo il cursore N".
// Scrittura (push): "ecco le modifiche fatte offline, dimmi cosa hai accettato".
//
// La regola per i conflitti è scritta una volta sola, nella clausola WHERE
// dell'ON CONFLICT: è il database a decidere, in modo atomico, chi vince. Non
// c'è nessuna finestra fra "leggo la versione attuale" e "scrivo la mia".

import type { DbClient } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { join, queryOne, queryRows, raw, sql, type SqlQuery } from '../db/sql.js';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
import type { SyncEntity } from '../types/domain.js';
import {
  ENTITIES,
  SYNC_ENTITY_NAMES,
  fieldByApiName,
  rowToApi,
  selectList,
  tableName,
} from './entities.js';

type Row = Record<string, unknown>;

export interface ChangeRecord {
  entity: SyncEntity;
  data: Record<string, unknown>;
}

export interface PullResult {
  changes: ChangeRecord[];
  cursor: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/**
 * Restituisce le righe con sync_seq maggiore del cursore, di tutte le entità,
 * ordinate globalmente.
 *
 * Il contatore è unico per utente e condiviso fra le tabelle, quindi mettere
 * insieme i risultati e ordinarli per sync_seq ricostruisce esattamente
 * l'ordine in cui le modifiche sono avvenute.
 */
export async function pullChanges(
  userId: string,
  since: number,
  limit: number,
  client?: DbClient,
): Promise<PullResult> {
  const pageSize = Math.min(Math.max(limit, 1), config.sync.maxChangesPerPage);

  const perEntity = await Promise.all(
    SYNC_ENTITY_NAMES.map(async (entity) => {
      // Si chiede una riga in più del necessario per sapere se ce ne sono altre.
      const rows = await queryRows<Row>(
        sql`SELECT ${selectList(entity)}
              FROM ${tableName(entity)}
             WHERE user_id = ${userId} AND sync_seq > ${since}
             ORDER BY sync_seq ASC
             LIMIT ${pageSize + 1}`,
        client,
      );
      return { entity, rows };
    }),
  );

  const merged: Array<{ entity: SyncEntity; row: Row; seq: number }> = [];
  for (const { entity, rows } of perEntity) {
    for (const row of rows) {
      merged.push({ entity, row, seq: Number(row['sync_seq']) });
    }
  }

  merged.sort((a, b) => a.seq - b.seq);

  const page = merged.slice(0, pageSize);
  const hasMore = merged.length > pageSize;

  // Il nuovo cursore è l'ultimo sync_seq effettivamente consegnato. Se non c'è
  // niente di nuovo resta quello di prima: il client non "salta" mai avanti.
  const cursor = page.length > 0 ? (page[page.length - 1] as { seq: number }).seq : since;

  return {
    changes: page.map(({ entity, row }) => ({ entity, data: rowToApi(entity, row) })),
    cursor,
    hasMore,
  };
}

/** Il valore massimo del contatore per un utente: è il "cursore attuale". */
export async function currentCursor(userId: string, client?: DbClient): Promise<number> {
  const row = await queryOne<{ current: number }>(
    sql`SELECT COALESCE(current, 0) AS current FROM sync_sequence WHERE user_id = ${userId}`,
    client,
  );
  return row?.current ?? 0;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

export interface PushItem {
  entity: SyncEntity;
  id: string;
  /** Versione su cui il client si è basato. Serve solo a raccontare l'esito. */
  baseVersion?: number;
  /** Quando la modifica è avvenuta sul dispositivo. Decide chi vince. */
  clientUpdatedAt: string;
  data: Record<string, unknown>;
}

export type PushOutcome = 'applied' | 'rejected' | 'ignored';

export interface PushResultItem {
  entity: SyncEntity;
  id: string;
  outcome: PushOutcome;
  /** Lo stato autorevole della riga dopo l'operazione. Il client lo adotta. */
  server: Record<string, unknown> | null;
  reason?: string;
}

export interface PushResult {
  results: PushResultItem[];
  cursor: number;
}

/**
 * Applica un lotto di modifiche arrivate dal dispositivo.
 *
 * Tutto in una transazione: o il lotto entra tutto, o non entra niente. Così
 * un'interruzione di rete a metà non lascia il server in uno stato che il
 * client crede diverso.
 */
export async function pushChanges(
  userId: string,
  deviceId: string | null,
  items: PushItem[],
): Promise<PushResult> {
  if (items.length > config.sync.maxPushBatch) {
    throw AppError.validation(
      `Troppe modifiche in una volta sola (massimo ${config.sync.maxPushBatch}).`,
    );
  }

  return withTransaction(async (client) => {
    const results: PushResultItem[] = [];

    for (const item of items) {
      results.push(await applyOne(userId, deviceId, item, client));
    }

    return { results, cursor: await currentCursor(userId, client) };
  });
}

async function applyOne(
  userId: string,
  deviceId: string | null,
  item: PushItem,
  client: DbClient,
): Promise<PushResultItem> {
  const spec = ENTITIES[item.entity];

  // Colonne scrivibili presenti nel payload.
  const columns: string[] = [];
  const values: SqlQuery[] = [];

  for (const [key, value] of Object.entries(item.data)) {
    const field = fieldByApiName(item.entity, key);
    if (!field || value === undefined) continue;
    columns.push(field.db);
    values.push(sql`${value}`);
  }

  if (columns.length === 0) {
    return {
      entity: item.entity,
      id: item.id,
      outcome: 'ignored',
      server: await readRow(item.entity, userId, item.id, client),
      reason: 'nessun campo riconosciuto',
    };
  }

  const insertColumns = ['id', 'user_id', 'client_updated_at', 'last_device_id', ...columns];
  const insertValues: SqlQuery[] = [
    sql`${item.id}`,
    sql`${userId}`,
    sql`${item.clientUpdatedAt}`,
    sql`${deviceId}`,
    ...values,
  ];

  const assignments = columns.map((column) => sql`${raw(column)} = EXCLUDED.${raw(column)}`);
  assignments.push(sql`client_updated_at = EXCLUDED.client_updated_at`);
  assignments.push(sql`last_device_id = EXCLUDED.last_device_id`);

  const table = raw(spec.table);

  // La clausola che decide i conflitti.
  //
  //  1. la riga deve appartenere a chi sta scrivendo;
  //  2. una riga cancellata resta cancellata (la cancellazione vince sempre);
  //  3. vince la modifica avvenuta più tardi sul dispositivo;
  //  4. a parità esatta di istante decide l'id del dispositivo, così due
  //     dispositivi che risolvono lo stesso conflitto senza parlarsi arrivano
  //     comunque alla stessa conclusione.
  const conflictRule = spec.softDeletable
    ? sql`${table}.user_id = ${userId}
          AND ${table}.deleted_at IS NULL
          AND ( EXCLUDED.client_updated_at > ${table}.client_updated_at
             OR ( EXCLUDED.client_updated_at = ${table}.client_updated_at
                  AND COALESCE(EXCLUDED.last_device_id, '') > COALESCE(${table}.last_device_id, '') ) )`
    : sql`${table}.user_id = ${userId}
          AND ( EXCLUDED.client_updated_at > ${table}.client_updated_at
             OR ( EXCLUDED.client_updated_at = ${table}.client_updated_at
                  AND COALESCE(EXCLUDED.last_device_id, '') > COALESCE(${table}.last_device_id, '') ) )`;

  const applied = await queryOne<Row>(
    sql`INSERT INTO ${table} (${raw(insertColumns.join(', '))})
        VALUES (${join(insertValues, ', ')})
        ON CONFLICT (id) DO UPDATE
           SET ${join(assignments, ', ')}
         WHERE ${conflictRule}
        RETURNING ${selectList(item.entity)}`,
    client,
  );

  if (applied) {
    return {
      entity: item.entity,
      id: item.id,
      outcome: 'applied',
      server: rowToApi(item.entity, applied),
    };
  }

  // Nessuna riga restituita: la regola dei conflitti ha rifiutato la scrittura.
  // Restituiamo comunque lo stato autorevole, così il client si riallinea
  // invece di ritentare all'infinito.
  const server = await readRow(item.entity, userId, item.id, client);

  return {
    entity: item.entity,
    id: item.id,
    outcome: 'rejected',
    server,
    reason: server === null ? 'elemento non tuo o inesistente' : 'sul server c\'è una versione più recente',
  };
}

async function readRow(
  entity: SyncEntity,
  userId: string,
  id: string,
  client: DbClient,
): Promise<Record<string, unknown> | null> {
  const row = await queryOne<Row>(
    sql`SELECT ${selectList(entity)} FROM ${tableName(entity)}
         WHERE id = ${id} AND user_id = ${userId}`,
    client,
  );
  return row ? rowToApi(entity, row) : null;
}
