// FILE: backend/src/repositories/entities.ts
//
// Registro delle entità sincronizzabili.
//
// Ogni entità è descritta una volta sola: nome della tabella, campi, tipo di
// ogni campo. Da questa descrizione derivano automaticamente:
//
//   * la conversione riga → JSON (snake_case → camelCase, date in ISO…)
//   * le query di lettura per le API REST
//   * l'INSERT/UPDATE del motore di sincronizzazione
//
// Il vantaggio non è scrivere meno codice: è che aggiungere un campo si fa in
// un punto solo, e non può succedere che la sincronizzazione conosca un campo
// che le API ignorano (o viceversa).
//
// I nomi di tabella e colonna qui dentro sono costanti del sorgente, mai input
// dell'utente: è l'unico caso in cui finiscono nel testo SQL.

import { raw, type RawFragment } from '../db/sql.js';
import { numeric, timeToShort } from './mappers.js';
import type { SyncEntity } from '../types/domain.js';

export type FieldType =
  | 'text' // stringa
  | 'bool'
  | 'int'
  | 'numeric' // arriva come stringa, esce come number
  | 'date' // data di calendario "AAAA-MM-GG", senza fuso
  | 'time' // "18:30"
  | 'timestamp' // istante, esce in ISO 8601 UTC
  | 'intArray'
  | 'uuid';

export interface FieldSpec {
  /** Nome nel JSON delle API. */
  api: string;
  /** Nome della colonna. */
  db: string;
  type: FieldType;
  /** Se false, il client non può scriverlo (lo decide il server). */
  writable?: boolean;
}

export interface EntitySpec {
  entity: SyncEntity;
  table: string;
  /** Endpoint REST, per i messaggi di errore. */
  label: string;
  fields: FieldSpec[];
  /** Ordinamento predefinito nelle liste REST. */
  defaultOrder: string;
  /**
   * Alcune entità non si cancellano davvero mai dal punto di vista dell'app
   * (le impostazioni), altre sì.
   */
  softDeletable: boolean;
}

// I campi che ogni entità sincronizzabile ha in comune.
const META_FIELDS: FieldSpec[] = [
  { api: 'id', db: 'id', type: 'uuid', writable: false },
  { api: 'createdAt', db: 'created_at', type: 'timestamp', writable: false },
  { api: 'updatedAt', db: 'updated_at', type: 'timestamp', writable: false },
  { api: 'deletedAt', db: 'deleted_at', type: 'timestamp', writable: true },
  { api: 'version', db: 'version', type: 'int', writable: false },
  { api: 'syncSeq', db: 'sync_seq', type: 'int', writable: false },
  { api: 'clientUpdatedAt', db: 'client_updated_at', type: 'timestamp', writable: false },
];

const SETTINGS_META: FieldSpec[] = META_FIELDS.filter((f) => f.api !== 'deletedAt');

export const ENTITIES: Record<SyncEntity, EntitySpec> = {
  tasks: {
    entity: 'tasks',
    table: 'tasks',
    label: 'attività',
    defaultOrder: 'date ASC, time ASC NULLS LAST, created_at ASC',
    softDeletable: true,
    fields: [
      ...META_FIELDS,
      { api: 'title', db: 'title', type: 'text', writable: true },
      { api: 'description', db: 'description', type: 'text', writable: true },
      { api: 'date', db: 'date', type: 'date', writable: true },
      { api: 'time', db: 'time', type: 'time', writable: true },
      { api: 'isCompleted', db: 'is_completed', type: 'bool', writable: true },
      { api: 'priority', db: 'priority', type: 'text', writable: true },
      { api: 'category', db: 'category', type: 'text', writable: true },
      { api: 'notes', db: 'notes', type: 'text', writable: true },
      { api: 'repeatType', db: 'repeat_type', type: 'text', writable: true },
      { api: 'repeatDays', db: 'repeat_days', type: 'intArray', writable: true },
      { api: 'repeatUntil', db: 'repeat_until', type: 'date', writable: true },
      { api: 'seriesId', db: 'series_id', type: 'uuid', writable: true },
      { api: 'notificationEnabled', db: 'notification_enabled', type: 'bool', writable: true },
      {
        api: 'notificationMinutesBefore',
        db: 'notification_minutes_before',
        type: 'int',
        writable: true,
      },
      { api: 'completedAt', db: 'completed_at', type: 'timestamp', writable: true },
    ],
  },

  habits: {
    entity: 'habits',
    table: 'habits',
    label: 'abitudini',
    defaultOrder: 'sort_order ASC, created_at ASC',
    softDeletable: true,
    fields: [
      ...META_FIELDS,
      { api: 'name', db: 'name', type: 'text', writable: true },
      { api: 'icon', db: 'icon', type: 'text', writable: true },
      { api: 'color', db: 'color', type: 'text', writable: true },
      { api: 'frequency', db: 'frequency', type: 'text', writable: true },
      { api: 'targetDays', db: 'target_days', type: 'intArray', writable: true },
      { api: 'targetPerWeek', db: 'target_per_week', type: 'int', writable: true },
      { api: 'reminderTime', db: 'reminder_time', type: 'time', writable: true },
      { api: 'sortOrder', db: 'sort_order', type: 'int', writable: true },
    ],
  },

  habitCompletions: {
    entity: 'habitCompletions',
    table: 'habit_completions',
    label: 'completamenti',
    defaultOrder: 'date DESC',
    softDeletable: true,
    fields: [
      ...META_FIELDS,
      { api: 'habitId', db: 'habit_id', type: 'uuid', writable: true },
      { api: 'date', db: 'date', type: 'date', writable: true },
      { api: 'completed', db: 'completed', type: 'bool', writable: true },
    ],
  },

  moods: {
    entity: 'moods',
    table: 'moods',
    label: 'mood',
    defaultOrder: 'date DESC',
    softDeletable: true,
    fields: [
      ...META_FIELDS,
      { api: 'mood', db: 'mood', type: 'text', writable: true },
      { api: 'note', db: 'note', type: 'text', writable: true },
      { api: 'date', db: 'date', type: 'date', writable: true },
    ],
  },

  diaryEntries: {
    entity: 'diaryEntries',
    table: 'diary_entries',
    label: 'pagine del diario',
    defaultOrder: 'entry_date DESC, created_at DESC',
    softDeletable: true,
    fields: [
      ...META_FIELDS,
      { api: 'title', db: 'title', type: 'text', writable: true },
      { api: 'content', db: 'content', type: 'text', writable: true },
      { api: 'mood', db: 'mood', type: 'text', writable: true },
      { api: 'entryDate', db: 'entry_date', type: 'date', writable: true },
    ],
  },

  wishlist: {
    entity: 'wishlist',
    table: 'wishlist',
    label: 'desideri',
    defaultOrder: 'is_purchased ASC, created_at DESC',
    softDeletable: true,
    fields: [
      ...META_FIELDS,
      { api: 'title', db: 'title', type: 'text', writable: true },
      { api: 'description', db: 'description', type: 'text', writable: true },
      { api: 'price', db: 'price', type: 'numeric', writable: true },
      { api: 'currency', db: 'currency', type: 'text', writable: true },
      { api: 'imageUrl', db: 'image_url', type: 'text', writable: true },
      { api: 'productUrl', db: 'product_url', type: 'text', writable: true },
      { api: 'category', db: 'category', type: 'text', writable: true },
      { api: 'isPurchased', db: 'is_purchased', type: 'bool', writable: true },
      { api: 'purchasedAt', db: 'purchased_at', type: 'timestamp', writable: true },
    ],
  },

  quickNotes: {
    entity: 'quickNotes',
    table: 'quick_notes',
    label: 'note veloci',
    defaultOrder: 'created_at DESC',
    softDeletable: true,
    fields: [
      ...META_FIELDS,
      { api: 'content', db: 'content', type: 'text', writable: true },
      { api: 'convertedTaskId', db: 'converted_task_id', type: 'uuid', writable: true },
    ],
  },

  friendMessages: {
    entity: 'friendMessages',
    table: 'friend_messages',
    label: 'messaggi',
    defaultOrder: 'created_at ASC',
    softDeletable: true,
    fields: [
      ...META_FIELDS,
      { api: 'author', db: 'author', type: 'text', writable: true },
      { api: 'content', db: 'content', type: 'text', writable: true },
    ],
  },

  userSettings: {
    entity: 'userSettings',
    table: 'user_settings',
    label: 'impostazioni',
    defaultOrder: 'created_at ASC',
    softDeletable: false,
    fields: [
      ...SETTINGS_META,
      { api: 'morningNotifications', db: 'morning_notifications', type: 'bool', writable: true },
      { api: 'eveningNotifications', db: 'evening_notifications', type: 'bool', writable: true },
      { api: 'taskNotifications', db: 'task_notifications', type: 'bool', writable: true },
      { api: 'habitNotifications', db: 'habit_notifications', type: 'bool', writable: true },
      { api: 'selfCareNotifications', db: 'self_care_notifications', type: 'bool', writable: true },
      { api: 'darkMode', db: 'dark_mode', type: 'text', writable: true },
      { api: 'morningTime', db: 'morning_time', type: 'time', writable: true },
      { api: 'eveningTime', db: 'evening_time', type: 'time', writable: true },
      { api: 'weekStartsOnMonday', db: 'week_starts_on_monday', type: 'bool', writable: true },
    ],
  },
};

export const SYNC_ENTITY_NAMES = Object.keys(ENTITIES) as SyncEntity[];

// --- Derivati dalla descrizione ---------------------------------------------

const selectListCache = new Map<SyncEntity, RawFragment>();

/** Elenco delle colonne da leggere, come frammento SQL letterale. */
export function selectList(entity: SyncEntity): RawFragment {
  const cached = selectListCache.get(entity);
  if (cached) return cached;

  const spec = ENTITIES[entity];
  const fragment = raw(spec.fields.map((field) => field.db).join(', '));
  selectListCache.set(entity, fragment);
  return fragment;
}

export function tableName(entity: SyncEntity): RawFragment {
  return raw(ENTITIES[entity].table);
}

export function orderBy(entity: SyncEntity): RawFragment {
  return raw(ENTITIES[entity].defaultOrder);
}

function convertOut(value: unknown, type: FieldType): unknown {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'timestamp':
      return value instanceof Date ? value.toISOString() : String(value);
    case 'time':
      return timeToShort(String(value));
    case 'numeric':
      return typeof value === 'string' ? numeric(value) : value;
    case 'date':
      // Il type parser di pg le lascia come stringhe "AAAA-MM-GG".
      return String(value);
    default:
      return value;
  }
}

/** Converte una riga del database nell'oggetto che esce dalle API. */
export function rowToApi(entity: SyncEntity, row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of ENTITIES[entity].fields) {
    result[field.api] = convertOut(row[field.db], field.type);
  }
  return result;
}

export function writableFields(entity: SyncEntity): FieldSpec[] {
  return ENTITIES[entity].fields.filter((field) => field.writable === true);
}

/** Mappa nome-API → descrizione del campo, per validare ciò che arriva. */
export function fieldByApiName(entity: SyncEntity, apiName: string): FieldSpec | undefined {
  return ENTITIES[entity].fields.find((field) => field.api === apiName && field.writable === true);
}

export function isSyncEntity(value: string): value is SyncEntity {
  return Object.prototype.hasOwnProperty.call(ENTITIES, value);
}
