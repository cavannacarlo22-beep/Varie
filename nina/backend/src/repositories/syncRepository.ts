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

  const table = tableName(item.entity);
  const stamp = sql`${item.clientUpdatedAt}::timestamptz`;

  // La regola dei conflitti, espressa sulla riga già presente:
  //
  //  1. una riga cancellata resta cancellata (la cancellazione vince sempre);
  //  2. vince la modifica avvenuta più tardi sul dispositivo;
  //  3. a parità esatta di istante decide l'id del dispositivo, così due
  //     dispositivi che risolvono lo stesso conflitto senza parlarsi arrivano
  //     comunque alla stessa conclusione.
  const notDeleted = spec.softDeletable ? sql`AND deleted_at IS NULL` : sql``;

  const wins = sql`(
        ${stamp} > client_updated_at
     OR ( ${stamp} = client_updated_at
          AND COALESCE(${deviceId}, '') > COALESCE(last_device_id, '') ) )`;

  const assignments = columns.map((column, index) => sql`${raw(column)} = ${values[index]}`);
  assignments.push(sql`client_updated_at = ${stamp}`);
  assignments.push(sql`last_device_id = ${deviceId}`);

  // Primo tentativo: aggiornare la riga esistente.
  //
  // Non si usa INSERT ... ON CONFLICT perché PostgreSQL valida i vincoli
  // NOT NULL della parte INSERT *anche quando* la riga esiste già e verrà
  // solo aggiornata. Un aggiornamento parziale — il caso normale, il client
  // manda solo i campi che ha cambiato — fallirebbe su ogni colonna
  // obbligatoria che non ha incluso.
  const updated = await queryOne<Row>(
    sql`UPDATE ${table}
           SET ${join(assignments, ', ')}
         WHERE id = ${item.id} AND user_id = ${userId} ${notDeleted}
           AND ${wins}
        RETURNING ${selectList(item.entity)}`,
    client,
  );

  if (updated) {
    return {
      entity: item.entity,
      id: item.id,
      outcome: 'applied',
      server: rowToApi(item.entity, updated),
    };
  }

  // Nessuna riga aggiornata: o la riga non esiste ancora, o la regola dei
  // conflitti ha rifiutato la scrittura. Le due cose si distinguono guardando.
  const existing = await readRow(item.entity, userId, item.id, client);

  if (existing) {
    // Esiste, ma la modifica in arrivo ha perso. Si restituisce lo stato
    // autorevole: il client si riallinea invece di ritentare all'infinito.
    return {
      entity: item.entity,
      id: item.id,
      outcome: 'rejected',
      server: existing,
      reason: existing['deletedAt'] !== null
        ? 'l\'elemento è stato cancellato'
        : 'sul server c\'è una versione più recente',
    };
  }

  // La riga non c'è *per questo utente*: o è un elemento creato offline che
  // arriva per la prima volta, o quell'id appartiene a qualcun altro (la
  // chiave primaria è globale, la lettura è filtrata per user_id).
  const insertColumns = ['id', 'user_id', 'client_updated_at', 'last_device_id', ...columns];
  const insertValues: SqlQuery[] = [
    sql`${item.id}`,
    sql`${userId}`,
    stamp,
    sql`${deviceId}`,
    ...values,
  ];

  // L'INSERT è l'unico punto in cui una singola modifica può far fallire il
  // database: mancano campi obbligatori perché il dispositivo ha mandato un
  // aggiornamento parziale di qualcosa che il server non ha mai visto, oppure
  // quell'id esiste già e non è di questo utente.
  //
  // In un motore di sincronizzazione questo non deve buttare via l'intero
  // lotto: le altre modifiche del dispositivo sono valide e devono entrare.
  // Il SAVEPOINT serve proprio a questo — dopo un errore la transazione
  // sarebbe inutilizzabile, e il rollback al savepoint la rimette in piedi
  // senza annullare ciò che è già stato applicato.
  await client.query('SAVEPOINT nina_sync_insert');

  let inserted: Row | undefined;
  try {
    inserted = await queryOne<Row>(
      sql`INSERT INTO ${table} (${raw(insertColumns.join(', '))})
          VALUES (${join(insertValues, ', ')})
          ON CONFLICT (id) DO NOTHING
          RETURNING ${selectList(item.entity)}`,
      client,
    );
    await client.query('RELEASE SAVEPOINT nina_sync_insert');
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT nina_sync_insert');
    if (!riguardaSoloQuestaRiga(error)) throw error;

    // `readRow` è filtrata per utente: se l'id è di un'altra persona qui esce
    // null, e chi ha spinto la modifica non vede nemmeno che esiste.
    return {
      entity: item.entity,
      id: item.id,
      outcome: 'rejected',
      server: await readRow(item.entity, userId, item.id, client),
      reason: motivoDelRifiuto(error),
    };
  }

  if (inserted) {
    return {
      entity: item.entity,
      id: item.id,
      outcome: 'applied',
      server: rowToApi(item.entity, inserted),
    };
  }

  // DO NOTHING senza righe: fra la lettura e la scrittura qualcun altro ha
  // inserito questo id. Raro, ma possibile con due dispositivi che spingono
  // insieme. Si rilegge e si riporta lo stato autorevole.
  return {
    entity: item.entity,
    id: item.id,
    outcome: 'rejected',
    server: await readRow(item.entity, userId, item.id, client),
    reason: 'elemento inserito contemporaneamente da un altro dispositivo',
  };
}

/** Il codice SQLSTATE di un errore di PostgreSQL, se è uno di quelli. */
function codicePostgres(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Distingue "questa singola modifica non è accettabile" da "il database ha un
 * problema".
 *
 * Le classi 22 (dati non validi) e 23 (vincoli violati) di PostgreSQL sono
 * sempre il primo caso. Alcune di esse `translateDatabaseError` le ha già
 * trasformate in AppError con stato 400 o 409: anche quelle sono rifiuti della
 * singola riga. Tutto il resto — connessione caduta, timeout, errore di
 * sintassi — deve continuare a propagarsi e far fallire la richiesta.
 */
function riguardaSoloQuestaRiga(error: unknown): boolean {
  const code = codicePostgres(error);
  if (code !== undefined && (code.startsWith('22') || code.startsWith('23'))) return true;
  return error instanceof AppError && (error.statusCode === 400 || error.statusCode === 409);
}

/** Un motivo comprensibile, senza rivelare niente di chi possiede l'id. */
function motivoDelRifiuto(error: unknown): string {
  if (codicePostgres(error) === '23502') {
    return 'mancano dei campi obbligatori: il server non conosce questo elemento';
  }
  return 'la modifica non rispetta i vincoli del server';
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
