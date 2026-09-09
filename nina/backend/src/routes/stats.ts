// FILE: backend/src/routes/stats.ts
//
// "I miei progressi".
//
// Le statistiche si calcolano nel database con query aggregate invece di
// scaricare le righe e contarle in JavaScript: su un anno di attività la
// differenza è fra qualche millisecondo e qualche secondo.

import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { queryOne, queryRows, sql } from '../db/sql.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { CalendarDate } from './schemas.js';

export const statsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['stats'],
        summary: 'I miei progressi',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          period: Type.Optional(
            Type.Union([Type.Literal('week'), Type.Literal('month'), Type.Literal('year')], {
              default: 'month',
            }),
          ),
        }),
        response: {
          200: Type.Object({
            period: Type.String(),
            from: CalendarDate,
            to: CalendarDate,
            tasks: Type.Object({
              total: Type.Integer(),
              completed: Type.Integer(),
              completionRate: Type.Number(),
              byCategory: Type.Array(
                Type.Object({
                  category: Type.String(),
                  total: Type.Integer(),
                  completed: Type.Integer(),
                }),
              ),
              perDay: Type.Array(
                Type.Object({
                  date: CalendarDate,
                  total: Type.Integer(),
                  completed: Type.Integer(),
                }),
              ),
            }),
            habits: Type.Object({
              active: Type.Integer(),
              completionsInPeriod: Type.Integer(),
              bestStreak: Type.Integer(),
              bestStreakHabit: Type.Union([Type.String(), Type.Null()]),
            }),
            mood: Type.Object({
              entries: Type.Integer(),
              mostFrequent: Type.Union([Type.String(), Type.Null()]),
            }),
            diary: Type.Object({ entries: Type.Integer() }),
            productiveDays: Type.Integer({
              description: 'Giorni in cui almeno metà delle attività previste è stata completata.',
            }),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const period = request.query.period ?? 'month';
      const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;

      const to = new Date();
      const from = new Date(to);
      from.setUTCDate(from.getUTCDate() - (days - 1));
      const fromDate = from.toISOString().slice(0, 10);
      const toDate = to.toISOString().slice(0, 10);

      const taskTotals = await queryOne<{ total: string; completed: string }>(
        sql`SELECT count(*)::text AS total,
                   count(*) FILTER (WHERE is_completed)::text AS completed
              FROM tasks
             WHERE user_id = ${userId} AND deleted_at IS NULL
               AND date BETWEEN ${fromDate} AND ${toDate}`,
      );

      const byCategory = await queryRows<{ category: string; total: string; completed: string }>(
        sql`SELECT category,
                   count(*)::text AS total,
                   count(*) FILTER (WHERE is_completed)::text AS completed
              FROM tasks
             WHERE user_id = ${userId} AND deleted_at IS NULL
               AND date BETWEEN ${fromDate} AND ${toDate}
             GROUP BY category
             ORDER BY count(*) DESC`,
      );

      const perDay = await queryRows<{ date: string; total: string; completed: string }>(
        sql`SELECT date::text AS date,
                   count(*)::text AS total,
                   count(*) FILTER (WHERE is_completed)::text AS completed
              FROM tasks
             WHERE user_id = ${userId} AND deleted_at IS NULL
               AND date BETWEEN ${fromDate} AND ${toDate}
             GROUP BY date
             ORDER BY date ASC`,
      );

      const habitStats = await queryOne<{ active: string; completions: string }>(
        sql`SELECT (SELECT count(*)::text FROM habits
                     WHERE user_id = ${userId} AND deleted_at IS NULL) AS active,
                   (SELECT count(*)::text FROM habit_completions
                     WHERE user_id = ${userId} AND deleted_at IS NULL AND completed
                       AND date BETWEEN ${fromDate} AND ${toDate}) AS completions`,
      );

      // Streak più lungo: si numerano i giorni completati e si raggruppano per
      // "data meno numero d'ordine". Nelle sequenze consecutive quel valore è
      // costante, quindi ogni gruppo è una serie e la sua dimensione è la
      // lunghezza dello streak. È il modo standard di risolverlo in SQL.
      const bestStreak = await queryOne<{ habit: string | null; streak: string }>(
        sql`WITH numerate AS (
              SELECT c.habit_id, h.name, c.date,
                     c.date - (row_number() OVER (PARTITION BY c.habit_id ORDER BY c.date))::int
                       AS gruppo
                FROM habit_completions c
                JOIN habits h ON h.id = c.habit_id
               WHERE c.user_id = ${userId} AND c.deleted_at IS NULL AND c.completed
                 AND h.deleted_at IS NULL
            )
            SELECT name AS habit, count(*)::text AS streak
              FROM numerate
             GROUP BY habit_id, name, gruppo
             ORDER BY count(*) DESC
             LIMIT 1`,
      );

      const moodStats = await queryOne<{ entries: string; most_frequent: string | null }>(
        sql`SELECT count(*)::text AS entries,
                   (SELECT mood::text FROM moods
                     WHERE user_id = ${userId} AND deleted_at IS NULL
                       AND date BETWEEN ${fromDate} AND ${toDate}
                     GROUP BY mood ORDER BY count(*) DESC LIMIT 1) AS most_frequent
              FROM moods
             WHERE user_id = ${userId} AND deleted_at IS NULL
               AND date BETWEEN ${fromDate} AND ${toDate}`,
      );

      const diaryStats = await queryOne<{ entries: string }>(
        sql`SELECT count(*)::text AS entries FROM diary_entries
             WHERE user_id = ${userId} AND deleted_at IS NULL
               AND entry_date BETWEEN ${fromDate} AND ${toDate}`,
      );

      const total = Number.parseInt(taskTotals?.total ?? '0', 10);
      const completed = Number.parseInt(taskTotals?.completed ?? '0', 10);

      const productiveDays = perDay.filter((day) => {
        const dayTotal = Number.parseInt(day.total, 10);
        const dayDone = Number.parseInt(day.completed, 10);
        return dayTotal > 0 && dayDone / dayTotal >= 0.5;
      }).length;

      return {
        period,
        from: fromDate,
        to: toDate,
        tasks: {
          total,
          completed,
          completionRate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
          byCategory: byCategory.map((row) => ({
            category: row.category,
            total: Number.parseInt(row.total, 10),
            completed: Number.parseInt(row.completed, 10),
          })),
          perDay: perDay.map((row) => ({
            date: row.date,
            total: Number.parseInt(row.total, 10),
            completed: Number.parseInt(row.completed, 10),
          })),
        },
        habits: {
          active: Number.parseInt(habitStats?.active ?? '0', 10),
          completionsInPeriod: Number.parseInt(habitStats?.completions ?? '0', 10),
          bestStreak: Number.parseInt(bestStreak?.streak ?? '0', 10),
          bestStreakHabit: bestStreak?.habit ?? null,
        },
        mood: {
          entries: Number.parseInt(moodStats?.entries ?? '0', 10),
          mostFrequent: moodStats?.most_frequent ?? null,
        },
        diary: { entries: Number.parseInt(diaryStats?.entries ?? '0', 10) },
        productiveDays,
      };
    },
  );
};
