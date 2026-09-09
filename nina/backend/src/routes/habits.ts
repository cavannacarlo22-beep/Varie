// FILE: backend/src/routes/habits.ts

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { queryRows, sql } from '../db/sql.js';
import * as crud from '../repositories/crudRepository.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { deviceIdOf, notifyAfterWrite } from './helpers.js';
import {
  CalendarDate,
  HabitCompletionSchema,
  HabitCreateSchema,
  HabitSchema,
  HabitUpdateSchema,
  IdParam,
} from './schemas.js';

/**
 * Calcola lo streak: quanti giorni consecutivi, fino a oggi, l'abitudine è
 * stata rispettata.
 *
 * Il giorno corrente non interrompe lo streak se non è ancora stato spuntato:
 * alle 9 del mattino non ha senso dire a qualcuno che ha perso la serie.
 */
function computeStreak(completedDates: string[], today: string): number {
  const done = new Set(completedDates);

  const cursor = new Date(`${today}T12:00:00Z`);
  let streak = 0;

  // Se oggi non è ancora fatto si parte da ieri: la giornata non è finita.
  if (!done.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);

  for (let guard = 0; guard < 3650; guard += 1) {
    const day = cursor.toISOString().slice(0, 10);
    if (!done.has(day)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function longestStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;

  const sorted = [...completedDates].sort();
  let best = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = new Date(`${sorted[i - 1] as string}T12:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() + 1);

    if (previous.toISOString().slice(0, 10) === sorted[i]) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  return best;
}

type Habit = Static<typeof HabitSchema>;
type Completion = Static<typeof HabitCompletionSchema>;
export const habitRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['habits'],
        summary: 'Le mie abitudini, con streak e stato di oggi',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ date: Type.Optional(CalendarDate) }),
        response: {
          200: Type.Object({
            date: CalendarDate,
            items: Type.Array(
              Type.Intersect([
                HabitSchema,
                Type.Object({
                  doneToday: Type.Boolean(),
                  currentStreak: Type.Integer(),
                  bestStreak: Type.Integer(),
                }),
              ]),
            ),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const date = request.query.date ?? new Date().toISOString().slice(0, 10);

      const habits = await crud.listForUser<Habit>('habits', userId, { limit: 100 });

      // Una sola query per tutti i completamenti, invece di una per abitudine.
      const completions = await queryRows<{ habit_id: string; date: string }>(
        sql`SELECT habit_id, date
              FROM habit_completions
             WHERE user_id = ${userId} AND completed = TRUE AND deleted_at IS NULL
               AND date >= (${date}::date - INTERVAL '1 year')
             ORDER BY date DESC`,
      );

      const byHabit = new Map<string, string[]>();
      for (const row of completions) {
        const list = byHabit.get(row.habit_id) ?? [];
        list.push(row.date);
        byHabit.set(row.habit_id, list);
      }

      return {
        date,
        items: habits.map((habit) => {
          const dates = byHabit.get(habit['id'] as string) ?? [];
          return {
            ...habit,
            doneToday: dates.includes(date),
            currentStreak: computeStreak(dates, date),
            bestStreak: longestStreak(dates),
          };
        }),
      };
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['habits'],
        summary: 'Crea un\'abitudine',
        security: [{ bearerAuth: [] }],
        body: HabitCreateSchema,
        response: { 201: HabitSchema },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const created = await crud.create<Habit>('habits', userId, deviceId, request.body);
      notifyAfterWrite(userId, deviceId);
      return reply.status(201).send(created);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        tags: ['habits'],
        summary: 'Modifica un\'abitudine',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: HabitUpdateSchema,
        response: { 200: HabitSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const updated = await crud.update<Habit>('habits', userId, deviceId, request.params.id, request.body);
      notifyAfterWrite(userId, deviceId);
      return updated;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['habits'],
        summary: 'Elimina un\'abitudine',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      await crud.softDelete<Habit>('habits', userId, deviceId, request.params.id);
      notifyAfterWrite(userId, deviceId);
      return { ok: true };
    },
  );

  app.post(
    '/:id/toggle',
    {
      schema: {
        tags: ['habits'],
        summary: 'Spunta (o toglie la spunta a) un\'abitudine per un giorno',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({
          date: Type.Optional(CalendarDate),
          completed: Type.Optional(Type.Boolean()),
        }),
        response: {
          200: Type.Object({
            completion: HabitCompletionSchema,
            currentStreak: Type.Integer(),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const habitId = request.params.id;
      const date = request.body.date ?? new Date().toISOString().slice(0, 10);

      // L'abitudine deve esistere ed essere di chi la sta spuntando.
      await crud.requireById<Habit>('habits', userId, habitId);

      const existing = await crud.listForUser<Completion>('habitCompletions', userId, {
        includeDeleted: true,
        extraConditions: [sql`habit_id = ${habitId}`, sql`date = ${date}`],
        limit: 1,
      });

      const target =
        request.body.completed ??
        !(existing[0] && existing[0]['deletedAt'] === null && existing[0]['completed'] === true);

      let completion: Completion;

      if (existing[0]) {
        completion = await crud.update<Completion>(
          'habitCompletions',
          userId,
          deviceId,
          existing[0]['id'] as string,
          { completed: target, deletedAt: null },
        );
      } else {
        completion = await crud.create<Completion>('habitCompletions', userId, deviceId, {
          habitId,
          date,
          completed: target,
        });
      }

      const dates = await queryRows<{ date: string }>(
        sql`SELECT date FROM habit_completions
             WHERE user_id = ${userId} AND habit_id = ${habitId}
               AND completed = TRUE AND deleted_at IS NULL
             ORDER BY date DESC LIMIT 400`,
      );

      notifyAfterWrite(userId, deviceId);

      return {
        completion,
        currentStreak: computeStreak(
          dates.map((row) => row.date),
          new Date().toISOString().slice(0, 10),
        ),
      };
    },
  );

  app.get(
    '/completions',
    {
      schema: {
        tags: ['habits'],
        summary: 'Completamenti in un intervallo, per la griglia mensile',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ from: CalendarDate, to: CalendarDate }),
        response: { 200: Type.Object({ items: Type.Array(HabitCompletionSchema) }) },
      },
    },
    async (request) => {
      const items = await crud.listForUser<Completion>('habitCompletions', currentUserId(request), {
        extraConditions: [
          sql`date >= ${request.query.from}`,
          sql`date <= ${request.query.to}`,
        ],
        limit: 1000,
      });
      return { items };
    },
  );
};
