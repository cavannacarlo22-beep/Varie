import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export interface Settings {
  name: string;
  greeting: string;
  quote: string;
  quoteAuthor: string;
  rotateQuotes: boolean;
  theme: 'rosa' | 'lavanda' | 'cielo' | 'pesca' | 'notte';
  accent: string;
  hearts: boolean;
  notifications: boolean;
  defaultReminder: number;
  weekStartsMonday: boolean;
  dashboardWidgets: string[];
  favoriteFonts: string[];
  recentFonts: string[];
  editorFont: string;
  editorFontSize: number;
  editorLineHeight: number;
  editorPaper: 'blank' | 'lines' | 'grid' | 'dots';
  editorWidth: 'narrow' | 'normal' | 'wide';
  spellcheck: boolean;
  pinHash: string;
  pinSalt: string;
  lockAfterMinutes: number;
  autoSnapshot: boolean;
  lastSnapshotAt: number;
  lastExportAt: number;
  backupReminderDays: number;
  pencilOnly: boolean;
  focusMinutes: number;
  breakMinutes: number;
  waterGoal: number;
  graduationScale: 110 | 100;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  greeting: 'auto',
  quote: 'Un passo alla volta, ma ogni giorno.',
  quoteAuthor: '',
  rotateQuotes: true,
  theme: 'rosa',
  accent: '#e46f8e',
  hearts: true,
  notifications: true,
  defaultReminder: 30,
  weekStartsMonday: true,
  dashboardWidgets: ['today', 'calendar', 'events', 'tasks', 'notes', 'memos', 'files', 'calc', 'study', 'wellness'],
  favoriteFonts: ['Playfair Display', 'Caveat', 'Lora', 'Poppins'],
  recentFonts: [],
  editorFont: 'Lora',
  editorFontSize: 17,
  editorLineHeight: 1.7,
  editorPaper: 'lines',
  editorWidth: 'normal',
  spellcheck: true,
  pinHash: '',
  pinSalt: '',
  lockAfterMinutes: 0,
  autoSnapshot: true,
  lastSnapshotAt: 0,
  lastExportAt: 0,
  backupReminderDays: 7,
  pencilOnly: false,
  focusMinutes: 25,
  breakMinutes: 5,
  waterGoal: 8,
  graduationScale: 110,
  onboarded: false,
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out as unknown as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

export async function setSettings(partial: Partial<Settings>): Promise<void> {
  await db.settings.bulkPut(Object.entries(partial).map(([key, value]) => ({ key, value })));
}

export function useSettings(): Settings {
  const s = useLiveQuery(getSettings, []);
  return s ?? DEFAULT_SETTINGS;
}

/** True once the settings were read from the database (avoids flashing defaults). */
export function useSettingsLoaded(): Settings | undefined {
  return useLiveQuery(getSettings, []);
}
