// FILE: backend/src/repositories/mappers.ts
//
// Conversioni fra le righe del database e i tipi delle API.
//
// Regola: le date diventano stringhe ISO 8601 in UTC; le *date di calendario*
// (compleanni, il giorno di un'attività) restano stringhe "AAAA-MM-GG" perché
// non hanno un fuso orario — vedi il type parser in db/pool.ts.

import type { SyncMeta } from '../types/domain.js';

export interface SyncRow {
  id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  version: number;
  sync_seq: number;
  client_updated_at: Date;
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function isoRequired(value: Date): string {
  return value.toISOString();
}

export function syncMeta(row: SyncRow): SyncMeta {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    deletedAt: iso(row.deleted_at),
    version: row.version,
    syncSeq: row.sync_seq,
    clientUpdatedAt: row.client_updated_at.toISOString(),
  };
}

/**
 * TIME di PostgreSQL arriva come "18:30:00". L'app vuole "18:30".
 * Restituiamo i secondi solo se sono diversi da zero.
 */
export function timeToShort(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return value;
  const seconds = match[3];
  return seconds && seconds !== '00'
    ? `${match[1]}:${match[2]}:${seconds}`
    : `${match[1]}:${match[2]}`;
}

/** NUMERIC arriva come stringa per non perdere precisione. */
export function numeric(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
