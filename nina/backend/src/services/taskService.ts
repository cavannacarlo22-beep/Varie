// FILE: backend/src/services/taskService.ts
//
// Le attività ricorrenti.
//
// Scelta di fondo: una ripetizione genera *righe vere*, una per occorrenza,
// legate dallo stesso `series_id`. L'alternativa — tenere solo la regola e
// calcolare le occorrenze al volo — sembra più elegante ma si rompe subito:
// se spunti la palestra di martedì, quel completamento deve appartenere a
// quell'occorrenza, non alla regola. E se sposti solo il giovedì, quella
// singola occorrenza deve poter divergere.
//
// Le occorrenze si generano fino a 90 giorni avanti (o fino alla data di fine,
// se prima). È abbastanza per calendario e notifiche, e tiene il database
// piccolo. Il rifornimento avviene quando serve, in `topUpSeries`.

import { randomUUID } from 'node:crypto';
import type { DbClient } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { execute, queryOne, queryRows, sql } from '../db/sql.js';
import { AppError } from '../utils/errors.js';
import * as crud from '../repositories/crudRepository.js';
import type { RepeatType } from '../types/domain.js';

const HORIZON_DAYS = 90;
const MAX_OCCURRENCES = 200;

function parseDate(value: string): Date {
  // Le date di calendario si trattano a mezzogiorno UTC: così spostarsi di un
  // giorno non può mai cadere sul confine dell'ora legale e produrre un
  // "giorno prima" o un "giorno dopo".
  return new Date(`${value}T12:00:00Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  const targetMonth = copy.getUTCMonth() + months;
  const dayOfMonth = copy.getUTCDate();

  copy.setUTCDate(1);
  copy.setUTCMonth(targetMonth);

  // Il 31 gennaio + 1 mese non è il 3 marzo: è l'ultimo giorno di febbraio.
  const lastDayOfTargetMonth = new Date(
    Date.UTC(copy.getUTCFullYear(), copy.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  copy.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  return copy;
}

/** Giorno della settimana in formato ISO: 1 = lunedì … 7 = domenica. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Calcola le date di una serie, a partire da `from` (esclusa se già presente).
 */
export function occurrenceDates(
  startDate: string,
  repeatType: RepeatType,
  repeatDays: number[],
  repeatUntil: string | null,
  from: string,
  limit: number = MAX_OCCURRENCES,
): string[] {
  if (repeatType === 'NEVER') return [];

  const start = parseDate(startDate);
  const cursorStart = parseDate(from);
  const horizon = addDays(cursorStart, HORIZON_DAYS);
  const end = repeatUntil ? parseDate(repeatUntil) : horizon;
  const lastDay = end < horizon ? end : horizon;

  const dates: string[] = [];

  if (repeatType === 'MONTHLY') {
    let candidate = start;
    let step = 0;
    while (candidate <= lastDay && dates.length < limit && step < 400) {
      if (candidate > cursorStart) dates.push(formatDate(candidate));
      step += 1;
      candidate = addMonths(start, step);
    }
    return dates;
  }

  // DAILY, WEEKLY e CUSTOM si esprimono tutti come "quali giorni della settimana".
  const allowedDays =
    repeatType === 'DAILY'
      ? [1, 2, 3, 4, 5, 6, 7]
      : repeatType === 'WEEKLY'
        ? [isoWeekday(start)]
        : repeatDays.length > 0
          ? repeatDays
          : [isoWeekday(start)];

  const allowed = new Set(allowedDays);
  let candidate = addDays(cursorStart, 1);

  while (candidate <= lastDay && dates.length < limit) {
    if (candidate >= start && allowed.has(isoWeekday(candidate))) {
      dates.push(formatDate(candidate));
    }
    candidate = addDays(candidate, 1);
  }

  return dates;
}

interface TaskInput {
  [key: string]: unknown;
  title: string;
  date: string;
  repeatType?: RepeatType;
  repeatDays?: number[];
  repeatUntil?: string | null;
}

/**
 * Crea un'attività. Se è ricorrente crea anche le occorrenze future.
 * Restituisce sempre la prima occorrenza, quella che l'utente ha appena scritto.
 */
export async function createTask(
  userId: string,
  deviceId: string | null,
  input: TaskInput,
): Promise<crud.ApiObject> {
  const repeatType = (input.repeatType ?? 'NEVER') as RepeatType;

  if (repeatType === 'NEVER') {
    return crud.create('tasks', userId, deviceId, input);
  }

  const seriesId = randomUUID();

  return withTransaction(async (client) => {
    const first = await crud.create(
      'tasks',
      userId,
      deviceId,
      { ...input, seriesId },
      client,
    );

    const dates = occurrenceDates(
      input.date,
      repeatType,
      input.repeatDays ?? [],
      input.repeatUntil ?? null,
      input.date,
    );

    for (const date of dates) {
      await crud.create(
        'tasks',
        userId,
        deviceId,
        {
          ...input,
          id: undefined,
          seriesId,
          date,
          isCompleted: false,
          completedAt: null,
        },
        client,
      );
    }

    return first;
  });
}

/**
 * Rifornisce le serie che stanno per esaurirsi.
 *
 * Viene chiamata quando l'app chiede le attività di un intervallo che va oltre
 * l'ultima occorrenza generata: così le ripetizioni "per sempre" continuano
 * davvero, senza generare migliaia di righe in anticipo.
 */
export async function topUpSeries(userId: string, upTo: string, client?: DbClient): Promise<number> {
  const series = await queryRows<{
    series_id: string;
    repeat_type: RepeatType;
    repeat_days: number[];
    repeat_until: string | null;
    last_date: string;
    title: string;
    description: string | null;
    time: string | null;
    priority: string;
    category: string;
    notes: string | null;
    notification_enabled: boolean;
    notification_minutes_before: number;
  }>(
    sql`SELECT DISTINCT ON (series_id)
               series_id, repeat_type, repeat_days, repeat_until,
               max(date) OVER (PARTITION BY series_id) AS last_date,
               title, description, time, priority, category, notes,
               notification_enabled, notification_minutes_before
          FROM tasks
         WHERE user_id = ${userId}
           AND series_id IS NOT NULL
           AND deleted_at IS NULL
           AND repeat_type <> 'NEVER'
         ORDER BY series_id, date DESC`,
    client,
  );

  let created = 0;

  for (const row of series) {
    if (row.last_date >= upTo) continue;
    if (row.repeat_until && row.repeat_until <= row.last_date) continue;

    const dates = occurrenceDates(
      row.last_date,
      row.repeat_type,
      row.repeat_days,
      row.repeat_until,
      row.last_date,
    );

    for (const date of dates) {
      await crud.create(
        'tasks',
        userId,
        null,
        {
          seriesId: row.series_id,
          title: row.title,
          description: row.description,
          date,
          time: row.time,
          priority: row.priority,
          category: row.category,
          notes: row.notes,
          repeatType: row.repeat_type,
          repeatDays: row.repeat_days,
          repeatUntil: row.repeat_until,
          notificationEnabled: row.notification_enabled,
          notificationMinutesBefore: row.notification_minutes_before,
        },
        client,
      );
      created += 1;
    }
  }

  return created;
}

/** Cancella tutte le occorrenze future di una serie, compresa quella indicata. */
export async function deleteSeriesFrom(
  userId: string,
  deviceId: string | null,
  taskId: string,
): Promise<number> {
  const task = await queryOne<{ series_id: string | null; date: string }>(
    sql`SELECT series_id, date FROM tasks WHERE id = ${taskId} AND user_id = ${userId}`,
  );

  if (!task) throw AppError.notFound('Questa attività non esiste.');
  if (!task.series_id) {
    await crud.softDelete('tasks', userId, deviceId, taskId);
    return 1;
  }

  return execute(
    sql`UPDATE tasks
           SET deleted_at        = COALESCE(deleted_at, now()),
               client_updated_at = ${new Date().toISOString()},
               last_device_id    = ${deviceId}
         WHERE user_id   = ${userId}
           AND series_id = ${task.series_id}
           AND date      >= ${task.date}
           AND deleted_at IS NULL`,
  );
}

/** Applica una modifica a tutte le occorrenze future di una serie. */
export async function updateSeriesFrom(
  userId: string,
  deviceId: string | null,
  taskId: string,
  changes: Record<string, unknown>,
): Promise<number> {
  const task = await queryOne<{ series_id: string | null; date: string }>(
    sql`SELECT series_id, date FROM tasks WHERE id = ${taskId} AND user_id = ${userId}`,
  );

  if (!task) throw AppError.notFound('Questa attività non esiste.');

  if (!task.series_id) {
    await crud.update('tasks', userId, deviceId, taskId, changes);
    return 1;
  }

  const ids = await queryRows<{ id: string }>(
    sql`SELECT id FROM tasks
         WHERE user_id = ${userId} AND series_id = ${task.series_id}
           AND date >= ${task.date} AND deleted_at IS NULL`,
  );

  return withTransaction(async (client) => {
    for (const { id } of ids) {
      // La data non si propaga: sposterebbe tutte le occorrenze sullo stesso
      // giorno, che non è mai ciò che si intende.
      const { date: _ignored, ...rest } = changes;
      await crud.update('tasks', userId, deviceId, id, rest, client);
    }
    return ids.length;
  });
}
