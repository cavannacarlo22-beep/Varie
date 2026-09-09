// FILE: backend/src/routes/moods.ts

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { queryRows, sql } from '../db/sql.js';
import * as crud from '../repositories/crudRepository.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { deviceIdOf, notifyAfterWrite } from './helpers.js';
import { CalendarDate, IdParam, MoodCreateSchema, MoodSchema, MoodEnum } from './schemas.js';

/**
 * Punteggio numerico dei mood, per poterne fare una media e un grafico.
 * La scala va da 1 a 5; "nervosa" e "giù" stanno sotto la metà perché
 * descrivono giornate difficili, anche se in modi diversi.
 */
const MOOD_SCORE: Record<string, number> = {
  FANTASTICA: 5,
  BENE: 4,
  COSI_COSI: 3,
  STANCA: 2.5,
  NERVOSA: 2,
  GIU: 1,
};

type Mood = Static<typeof MoodSchema>;
export const moodRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['moods'],
        summary: 'I miei mood',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          from: Type.Optional(CalendarDate),
          to: Type.Optional(CalendarDate),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 400, default: 120 })),
        }),
        response: { 200: Type.Object({ items: Type.Array(MoodSchema) }) },
      },
    },
    async (request) => {
      const conditions = [];
      if (request.query.from) conditions.push(sql`date >= ${request.query.from}`);
      if (request.query.to) conditions.push(sql`date <= ${request.query.to}`);

      const items = await crud.listForUser<Mood>('moods', currentUserId(request), {
        extraConditions: conditions,
        limit: request.query.limit,
      });
      return { items };
    },
  );

  app.get(
    '/today',
    {
      schema: {
        tags: ['moods'],
        summary: 'Il mood di oggi, se già registrato',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ date: Type.Optional(CalendarDate) }),
        response: { 200: Type.Union([MoodSchema, Type.Null()]) },
      },
    },
    async (request) => {
      const date = request.query.date ?? new Date().toISOString().slice(0, 10);
      const items = await crud.listForUser<Mood>('moods', currentUserId(request), {
        extraConditions: [sql`date = ${date}`],
        limit: 1,
      });
      return items[0] ?? null;
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['moods'],
        summary: 'Registra come stai (o corregge il mood di oggi)',
        description:
          'C\'è un solo mood per giorno: se ne esiste già uno per quella data viene aggiornato, non duplicato.',
        security: [{ bearerAuth: [] }],
        body: MoodCreateSchema,
        response: { 200: MoodSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const date = request.body.date ?? new Date().toISOString().slice(0, 10);

      const existing = await crud.listForUser<Mood>('moods', userId, {
        includeDeleted: true,
        extraConditions: [sql`date = ${date}`],
        limit: 1,
      });

      const payload = {
        mood: request.body.mood,
        note: request.body.note ?? null,
        date,
        deletedAt: null,
      };

      const saved = existing[0]
        ? await crud.update<Mood>('moods', userId, deviceId, existing[0]['id'] as string, payload)
        : await crud.create<Mood>('moods', userId, deviceId, { ...payload, id: request.body.id });

      notifyAfterWrite(userId, deviceId);
      return saved;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['moods'],
        summary: 'Elimina un mood',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      await crud.softDelete<Mood>('moods', userId, deviceId, request.params.id);
      notifyAfterWrite(userId, deviceId);
      return { ok: true };
    },
  );

  app.get(
    '/stats',
    {
      schema: {
        tags: ['moods'],
        summary: 'Andamento dell\'umore',
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
            entries: Type.Integer(),
            averageScore: Type.Union([Type.Number(), Type.Null()]),
            distribution: Type.Array(
              Type.Object({ mood: MoodEnum, count: Type.Integer(), percent: Type.Number() }),
            ),
            timeline: Type.Array(Type.Object({ date: CalendarDate, mood: MoodEnum })),
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

      const rows = await queryRows<{ mood: string; date: string }>(
        sql`SELECT mood, date FROM moods
             WHERE user_id = ${userId} AND deleted_at IS NULL
               AND date BETWEEN ${fromDate} AND ${toDate}
             ORDER BY date ASC`,
      );

      const counts = new Map<string, number>();
      let scoreSum = 0;

      for (const row of rows) {
        counts.set(row.mood, (counts.get(row.mood) ?? 0) + 1);
        scoreSum += MOOD_SCORE[row.mood] ?? 3;
      }

      return {
        period,
        from: fromDate,
        to: toDate,
        entries: rows.length,
        averageScore: rows.length > 0 ? Number((scoreSum / rows.length).toFixed(2)) : null,
        distribution: [...counts.entries()]
          .map(([mood, count]) => ({
            mood,
            count,
            percent: Number(((count / rows.length) * 100).toFixed(1)),
          }))
          .sort((a, b) => b.count - a.count),
        timeline: rows.map((row) => ({ date: row.date, mood: row.mood })),
      };
    },
  );
};
