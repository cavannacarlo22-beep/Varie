import Dexie, { type Table } from 'dexie';
import type {
  CalcEntry, CalEvent, Category, DayLog, Exam, FileRec, FocusSession, Folder, Habit, HabitLog,
  ListItem, Memo, Note, Notebook, Setting, Sheet, Snapshot, TodoList,
} from './types';

export class PetaloDB extends Dexie {
  categories!: Table<Category, string>;
  events!: Table<CalEvent, string>;
  lists!: Table<TodoList, string>;
  items!: Table<ListItem, string>;
  sheets!: Table<Sheet, string>;
  calcHistory!: Table<CalcEntry, number>;
  folders!: Table<Folder, string>;
  files!: Table<FileRec, string>;
  notebooks!: Table<Notebook, string>;
  notes!: Table<Note, string>;
  memos!: Table<Memo, string>;
  exams!: Table<Exam, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  dayLogs!: Table<DayLog, string>;
  focus!: Table<FocusSession, number>;
  snapshots!: Table<Snapshot, number>;
  settings!: Table<Setting, string>;

  constructor(name = 'petalo') {
    super(name);
    this.version(1).stores({
      categories: 'id, order',
      events: 'id, date, categoryId, updatedAt',
      lists: 'id, order, kind',
      items: 'id, listId, order, done, dueDate',
      sheets: 'id, updatedAt',
      calcHistory: '++id, createdAt',
      folders: 'id, parentId',
      files: 'id, folderId, category, name, createdAt, favorite',
      notebooks: 'id, order',
      notes: 'id, notebookId, parentId, order, openedAt, updatedAt',
      memos: 'id, createdAt',
      exams: 'id, date, status',
      habits: 'id, order',
      habitLogs: 'id, habitId, date',
      dayLogs: 'date',
      focus: '++id, date',
      snapshots: '++id, createdAt',
      settings: 'key',
    });
  }
}

export const db = new PetaloDB();

/** Tables included in backups (snapshots are excluded on purpose). */
export const DATA_TABLES = [
  'categories', 'events', 'lists', 'items', 'sheets', 'calcHistory', 'folders', 'files',
  'notebooks', 'notes', 'memos', 'exams', 'habits', 'habitLogs', 'dayLogs', 'focus', 'settings',
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Università', color: '#e88aa3', order: 0 },
  { name: 'Esami', color: '#b49be0', order: 1 },
  { name: 'Lavoro', color: '#7fb5e0', order: 2 },
  { name: 'Personale', color: '#f2b880', order: 3 },
  { name: 'Salute', color: '#86c9a8', order: 4 },
  { name: 'Amici', color: '#f39cc0', order: 5 },
];

/** Seeds only structural defaults (categories) the first time; never fake content. */
export async function ensureDefaults(): Promise<void> {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, id: uid() })));
  }
}

/** Ask the browser not to evict our storage. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
