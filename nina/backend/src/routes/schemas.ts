// FILE: backend/src/routes/schemas.ts
//
// Schemi TypeBox riusabili. Sono contemporaneamente validazione a runtime,
// tipi TypeScript e documentazione OpenAPI: una definizione sola, tre usi.

import { Type, type TObject, type TSchema } from '@sinclair/typebox';
import {
  MOOD_KINDS,
  SELF_CARE_CATEGORIES,
  TASK_CATEGORIES,
  WISHLIST_CATEGORIES,
} from '../types/domain.js';

export const Uuid = Type.String({ format: 'uuid' });
export const IsoDateTime = Type.String({ minLength: 20, maxLength: 40 });
export const CalendarDate = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' });
export const ClockTime = Type.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$' });
export const HexColor = Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' });

export const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
export const Optional = <T extends TSchema>(schema: T) => Type.Optional(schema);

const literals = <T extends readonly string[]>(values: T) =>
  Type.Union(values.map((value) => Type.Literal(value)));

export const TaskCategoryEnum = literals(TASK_CATEGORIES);
export const WishlistCategoryEnum = literals(WISHLIST_CATEGORIES);
export const SelfCareCategoryEnum = literals(SELF_CARE_CATEGORIES);
export const MoodEnum = literals(MOOD_KINDS as readonly string[]);
export const PriorityEnum = literals(['LOW', 'MEDIUM', 'HIGH'] as const);
export const RepeatEnum = literals(['NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const);
export const FrequencyEnum = literals(['DAILY', 'WEEKLY', 'CUSTOM'] as const);
export const ThemeEnum = literals(['LIGHT', 'DARK', 'SYSTEM'] as const);

/** I campi che accompagnano ogni entità sincronizzabile. */
export const SyncMetaSchema = Type.Object({
  id: Uuid,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Nullable(IsoDateTime),
  version: Type.Integer(),
  syncSeq: Type.Integer(),
  clientUpdatedAt: IsoDateTime,
});

/** Unisce i metadati di sincronizzazione ai campi specifici dell'entità. */
export const withMeta = <T extends TObject>(schema: T) =>
  Type.Intersect([SyncMetaSchema, schema]);

/**
 * Campi che il client può inviare su qualunque entità:
 * l'id (generato offline) e l'istante della modifica sul dispositivo.
 */
export const ClientWriteFields = {
  id: Type.Optional(Uuid),
  clientUpdatedAt: Type.Optional(IsoDateTime),
};

export const WeekDays = Type.Array(Type.Integer({ minimum: 1, maximum: 7 }), {
  maxItems: 7,
  description: '1 = lunedì … 7 = domenica',
});

export const IdParam = Type.Object({ id: Uuid });

export const Pagination = {
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 200 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
};

export const OkSchema = Type.Object({ ok: Type.Boolean() });

// --- Entità -----------------------------------------------------------------

export const TaskSchema = withMeta(
  Type.Object({
    title: Type.String(),
    description: Nullable(Type.String()),
    date: CalendarDate,
    time: Nullable(ClockTime),
    isCompleted: Type.Boolean(),
    priority: PriorityEnum,
    category: TaskCategoryEnum,
    notes: Nullable(Type.String()),
    repeatType: RepeatEnum,
    repeatDays: WeekDays,
    repeatUntil: Nullable(CalendarDate),
    seriesId: Nullable(Uuid),
    notificationEnabled: Type.Boolean(),
    notificationMinutesBefore: Type.Integer(),
    completedAt: Nullable(IsoDateTime),
  }),
);

export const TaskCreateSchema = Type.Object({
  ...ClientWriteFields,
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  date: CalendarDate,
  time: Type.Optional(Nullable(ClockTime)),
  isCompleted: Type.Optional(Type.Boolean()),
  priority: Type.Optional(PriorityEnum),
  category: Type.Optional(TaskCategoryEnum),
  notes: Type.Optional(Nullable(Type.String({ maxLength: 5000 }))),
  repeatType: Type.Optional(RepeatEnum),
  repeatDays: Type.Optional(WeekDays),
  repeatUntil: Type.Optional(Nullable(CalendarDate)),
  notificationEnabled: Type.Optional(Type.Boolean()),
  notificationMinutesBefore: Type.Optional(Type.Integer({ minimum: 0, maximum: 10080 })),
});

export const TaskUpdateSchema = Type.Partial(Type.Omit(TaskCreateSchema, ['id']));

export const HabitSchema = withMeta(
  Type.Object({
    name: Type.String(),
    icon: Type.String(),
    color: Type.String(),
    frequency: FrequencyEnum,
    targetDays: WeekDays,
    targetPerWeek: Nullable(Type.Integer()),
    reminderTime: Nullable(ClockTime),
    sortOrder: Type.Integer(),
  }),
);

export const HabitCreateSchema = Type.Object({
  ...ClientWriteFields,
  name: Type.String({ minLength: 1, maxLength: 80 }),
  icon: Type.Optional(Type.String({ minLength: 1, maxLength: 8 })),
  color: Type.Optional(HexColor),
  frequency: Type.Optional(FrequencyEnum),
  targetDays: Type.Optional(WeekDays),
  targetPerWeek: Type.Optional(Nullable(Type.Integer({ minimum: 1, maximum: 7 }))),
  reminderTime: Type.Optional(Nullable(ClockTime)),
  sortOrder: Type.Optional(Type.Integer({ minimum: 0, maximum: 9999 })),
});

export const HabitUpdateSchema = Type.Partial(Type.Omit(HabitCreateSchema, ['id']));

export const HabitCompletionSchema = withMeta(
  Type.Object({
    habitId: Uuid,
    date: CalendarDate,
    completed: Type.Boolean(),
  }),
);

export const MoodSchema = withMeta(
  Type.Object({
    mood: MoodEnum,
    note: Nullable(Type.String()),
    date: CalendarDate,
  }),
);

export const MoodCreateSchema = Type.Object({
  ...ClientWriteFields,
  mood: MoodEnum,
  note: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  date: Type.Optional(CalendarDate),
});

export const DiarySchema = withMeta(
  Type.Object({
    title: Nullable(Type.String()),
    content: Type.String(),
    mood: Nullable(MoodEnum),
    entryDate: CalendarDate,
  }),
);

export const DiaryCreateSchema = Type.Object({
  ...ClientWriteFields,
  title: Type.Optional(Nullable(Type.String({ maxLength: 200 }))),
  content: Type.String({ minLength: 1, maxLength: 50000 }),
  mood: Type.Optional(Nullable(MoodEnum)),
  entryDate: Type.Optional(CalendarDate),
});

export const DiaryUpdateSchema = Type.Partial(Type.Omit(DiaryCreateSchema, ['id']));

export const WishlistSchema = withMeta(
  Type.Object({
    title: Type.String(),
    description: Nullable(Type.String()),
    price: Nullable(Type.Number()),
    currency: Type.String(),
    imageUrl: Nullable(Type.String()),
    productUrl: Nullable(Type.String()),
    category: WishlistCategoryEnum,
    isPurchased: Type.Boolean(),
    purchasedAt: Nullable(IsoDateTime),
  }),
);

export const WishlistCreateSchema = Type.Object({
  ...ClientWriteFields,
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  price: Type.Optional(Nullable(Type.Number({ minimum: 0, maximum: 9_999_999 }))),
  currency: Type.Optional(Type.String({ pattern: '^[A-Z]{3}$' })),
  imageUrl: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  productUrl: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  category: Type.Optional(WishlistCategoryEnum),
  isPurchased: Type.Optional(Type.Boolean()),
});

export const WishlistUpdateSchema = Type.Partial(Type.Omit(WishlistCreateSchema, ['id']));

export const QuickNoteSchema = withMeta(
  Type.Object({
    content: Type.String(),
    convertedTaskId: Nullable(Uuid),
  }),
);

export const FriendMessageSchema = withMeta(
  Type.Object({
    author: literals(['USER', 'NINA'] as const),
    content: Type.String(),
  }),
);

export const SettingsSchema = Type.Intersect([
  Type.Omit(SyncMetaSchema, ['deletedAt']),
  Type.Object({
    morningNotifications: Type.Boolean(),
    eveningNotifications: Type.Boolean(),
    taskNotifications: Type.Boolean(),
    habitNotifications: Type.Boolean(),
    selfCareNotifications: Type.Boolean(),
    darkMode: ThemeEnum,
    morningTime: ClockTime,
    eveningTime: ClockTime,
    weekStartsOnMonday: Type.Boolean(),
  }),
]);

export const SettingsUpdateSchema = Type.Object({
  morningNotifications: Type.Optional(Type.Boolean()),
  eveningNotifications: Type.Optional(Type.Boolean()),
  taskNotifications: Type.Optional(Type.Boolean()),
  habitNotifications: Type.Optional(Type.Boolean()),
  selfCareNotifications: Type.Optional(Type.Boolean()),
  darkMode: Type.Optional(ThemeEnum),
  morningTime: Type.Optional(ClockTime),
  eveningTime: Type.Optional(ClockTime),
  weekStartsOnMonday: Type.Optional(Type.Boolean()),
  clientUpdatedAt: Type.Optional(IsoDateTime),
});

export const QuoteSchema = Type.Object({
  id: Uuid,
  text: Type.String(),
  author: Nullable(Type.String()),
  source: Nullable(Type.String()),
  language: Type.String(),
  isActive: Type.Boolean(),
  isFavorite: Type.Optional(Type.Boolean()),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const SelfCareSchema = Type.Object({
  id: Uuid,
  title: Type.String(),
  description: Nullable(Type.String()),
  category: SelfCareCategoryEnum,
  durationMin: Nullable(Type.Integer()),
  isActive: Type.Boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
