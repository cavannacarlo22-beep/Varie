// FILE: backend/src/types/domain.ts
//
// I tipi delle righe come arrivano dal database (snake_case) e i tipi che
// escono dalle API (camelCase). La conversione avviene in un solo punto per
// entità, nei repository: le rotte non vedono mai snake_case.

export type UserRole = 'USER' | 'ADMIN';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RepeatType = 'NEVER' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type HabitFrequency = 'DAILY' | 'WEEKLY' | 'CUSTOM';
export type MoodKind = 'FANTASTICA' | 'BENE' | 'COSI_COSI' | 'STANCA' | 'GIU' | 'NERVOSA';
export type FriendAuthor = 'USER' | 'NINA';
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export const TASK_CATEGORIES = [
  'LAVORO',
  'CASA',
  'PERSONALE',
  'SPORT',
  'STUDIO',
  'SHOPPING',
  'SOCIAL',
  'ALTRO',
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const WISHLIST_CATEGORIES = [
  'MODA',
  'BEAUTY',
  'CASA',
  'TECH',
  'VIAGGI',
  'LIBRI',
  'ESPERIENZE',
  'ALTRO',
] as const;
export type WishlistCategory = (typeof WISHLIST_CATEGORIES)[number];

export const SELF_CARE_CATEGORIES = [
  'RELAX',
  'CORPO',
  'MENTE',
  'CASA',
  'FUORI',
  'CREATIVITA',
  'SOCIAL',
  'DIGITALE',
] as const;
export type SelfCareCategory = (typeof SELF_CARE_CATEGORIES)[number];

export const MOOD_KINDS: readonly MoodKind[] = [
  'FANTASTICA',
  'BENE',
  'COSI_COSI',
  'STANCA',
  'GIU',
  'NERVOSA',
];

/** Le tabelle che partecipano alla sincronizzazione per cursore. */
export const SYNC_ENTITIES = [
  'tasks',
  'habits',
  'habitCompletions',
  'moods',
  'diaryEntries',
  'wishlist',
  'quickNotes',
  'friendMessages',
  'userSettings',
] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

/** Campi comuni a ogni entità sincronizzabile, come li vede l'app. */
export interface SyncMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
  syncSeq: number;
  clientUpdatedAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    isActive: row.is_active,
    emailVerified: row.email_verified_at !== null,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

export interface UserSettings extends SyncMeta {
  morningNotifications: boolean;
  eveningNotifications: boolean;
  taskNotifications: boolean;
  habitNotifications: boolean;
  selfCareNotifications: boolean;
  darkMode: ThemePreference;
  morningTime: string;
  eveningTime: string;
  weekStartsOnMonday: boolean;
}

export interface Task extends SyncMeta {
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  isCompleted: boolean;
  priority: TaskPriority;
  category: TaskCategory;
  notes: string | null;
  repeatType: RepeatType;
  repeatDays: number[];
  repeatUntil: string | null;
  seriesId: string | null;
  notificationEnabled: boolean;
  notificationMinutesBefore: number;
  completedAt: string | null;
}

export interface Habit extends SyncMeta {
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  targetDays: number[];
  targetPerWeek: number | null;
  reminderTime: string | null;
  sortOrder: number;
}

export interface HabitCompletion extends SyncMeta {
  habitId: string;
  date: string;
  completed: boolean;
}

export interface Mood extends SyncMeta {
  mood: MoodKind;
  note: string | null;
  date: string;
}

export interface DiaryEntry extends SyncMeta {
  title: string | null;
  content: string;
  mood: MoodKind | null;
  entryDate: string;
}

export interface WishlistItem extends SyncMeta {
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  productUrl: string | null;
  category: WishlistCategory;
  isPurchased: boolean;
  purchasedAt: string | null;
}

export interface QuickNote extends SyncMeta {
  content: string;
  convertedTaskId: string | null;
}

export interface FriendMessage extends SyncMeta {
  author: FriendAuthor;
  content: string;
}

export interface MotivationQuote {
  id: string;
  text: string;
  author: string | null;
  source: string | null;
  language: string;
  isActive: boolean;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SelfCareIdea {
  id: string;
  title: string;
  description: string | null;
  category: SelfCareCategory;
  durationMin: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Contenuto del token di accesso. */
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  dn: string;
}
