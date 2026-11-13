export type ID = string;

export interface Category {
  id: ID;
  name: string;
  color: string;
  order: number;
}

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CalEvent {
  id: ID;
  title: string;
  description: string;
  notes: string;
  location: string;
  /** Local date `YYYY-MM-DD` */
  date: string;
  /** `HH:mm`, empty when allDay */
  startTime: string;
  endTime: string;
  allDay: boolean;
  categoryId: ID | null;
  /** minutes before start; null = no reminder */
  reminder: number | null;
  repeat: Repeat;
  /** occurrence keys (date) already notified */
  notified: string[];
  createdAt: number;
  updatedAt: number;
}

export type ListKind = 'studio' | 'lavoro' | 'casa' | 'personale' | 'spesa' | 'viaggi' | 'altro';

export interface TodoList {
  id: ID;
  title: string;
  kind: ListKind;
  color: string;
  emoji: string;
  order: number;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ListItem {
  id: ID;
  listId: ID;
  text: string;
  note: string;
  done: boolean;
  order: number;
  dueDate: string;
  priority: 0 | 1 | 2 | 3;
  createdAt: number;
  completedAt: number | null;
}

export interface Sheet {
  id: ID;
  name: string;
  rows: number;
  cols: number;
  /** raw cell inputs keyed by A1 address */
  cells: Record<string, string>;
  /** optional per-cell format */
  formats: Record<string, { bold?: boolean; align?: 'left' | 'center' | 'right'; bg?: string; decimals?: number }>;
  colWidths: Record<number, number>;
  createdAt: number;
  updatedAt: number;
}

export interface CalcEntry {
  id?: number;
  expression: string;
  result: string;
  source: 'calcolatrice' | 'tabella';
  createdAt: number;
}

export interface Folder {
  id: ID;
  name: string;
  parentId: ID | null;
  color: string;
  createdAt: number;
}

export type FileCategory = 'pdf' | 'word' | 'excel' | 'immagine' | 'presentazione' | 'testo' | 'audio' | 'video' | 'archivio' | 'altro';

export interface FileRec {
  id: ID;
  name: string;
  folderId: ID | null;
  mime: string;
  size: number;
  category: FileCategory;
  blob: Blob;
  favorite: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type Paper = 'blank' | 'lines' | 'grid' | 'dots';

export interface NotebookCover {
  color: string;
  pattern: 'hearts' | 'dots' | 'stripes' | 'grid' | 'plain' | 'flowers';
  emoji: string;
  image?: string;
}

export interface Notebook {
  id: ID;
  title: string;
  subject: string;
  professor: string;
  cover: NotebookCover;
  paper: Paper;
  order: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: ID;
  notebookId: ID;
  parentId: ID | null;
  title: string;
  /** TipTap JSON document */
  content: unknown;
  /** plain text for search */
  text: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  openedAt: number;
}

export interface Memo {
  id: ID;
  text: string;
  color: string;
  dueAt: string;
  done: boolean;
  createdAt: number;
}

export interface Exam {
  id: ID;
  name: string;
  cfu: number;
  /** 18..30, 31 = 30 e lode, 0 = idoneità / non votato */
  grade: number;
  date: string;
  status: 'superato' | 'da-sostenere';
  notebookId: ID | null;
  notes: string;
  createdAt: number;
}

export interface Habit {
  id: ID;
  name: string;
  emoji: string;
  color: string;
  order: number;
  archived: boolean;
  createdAt: number;
}

export interface HabitLog {
  /** `${habitId}|${date}` */
  id: string;
  habitId: ID;
  date: string;
}

export interface DayLog {
  date: string;
  mood: number;
  water: number;
  sleep: number;
  period: boolean;
  journal: string;
  gratitude: string;
}

export interface FocusSession {
  id?: number;
  date: string;
  minutes: number;
  label: string;
  createdAt: number;
}

export interface Snapshot {
  id?: number;
  createdAt: number;
  size: number;
  data: string;
}

export interface Setting {
  key: string;
  value: unknown;
}
