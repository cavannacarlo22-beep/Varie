// FILE: backend/src/routes/diary.ts
//
// Il diario è la parte più privata dell'app. Ogni query di questo file filtra
// per l'utente del token, e nessuna rotta amministrativa legge questa tabella.

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { queryRows, sql } from '../db/sql.js';
import * as crud from '../repositories/crudRepository.js';
import { rowToApi } from '../repositories/entities.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { deviceIdOf, notifyAfterWrite } from './helpers.js';
import {
  CalendarDate,
  DiaryCreateSchema,
  DiarySchema,
  DiaryUpdateSchema,
  IdParam,
  Pagination,
} from './schemas.js';

type Diary = Static<typeof DiarySchema>;
export const diaryRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['diary'],
        summary: 'Le mie pagine di diario',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          from: Type.Optional(CalendarDate),
          to: Type.Optional(CalendarDate),
          ...Pagination,
        }),
        response: { 200: Type.Object({ items: Type.Array(DiarySchema) }) },
      },
    },
    async (request) => {
      const conditions = [];
      if (request.query.from) conditions.push(sql`entry_date >= ${request.query.from}`);
      if (request.query.to) conditions.push(sql`entry_date <= ${request.query.to}`);

      const items = await crud.listForUser<Diary>('diaryEntries', currentUserId(request), {
        extraConditions: conditions,
        limit: request.query.limit,
        offset: request.query.offset,
      });
      return { items };
    },
  );

  app.get(
    '/search',
    {
      schema: {
        tags: ['diary'],
        summary: 'Cerca nel diario',
        description:
          'Ricerca full-text in italiano su titolo e contenuto, con l\'indice GIN creato nelle migration.',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          q: Type.String({ minLength: 2, maxLength: 200 }),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 30 })),
        }),
        response: { 200: Type.Object({ items: Type.Array(DiarySchema) }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const term = request.query.q.trim();

      // plainto_tsquery interpreta il testo come parole da cercare, senza
      // sintassi speciale: quello che scrive l'utente non può diventare
      // un'espressione di ricerca inattesa.
      const rows = await queryRows<Record<string, unknown>>(
        sql`SELECT id, user_id, title, content, mood, entry_date, created_at, updated_at,
                   deleted_at, version, sync_seq, client_updated_at
              FROM diary_entries
             WHERE user_id = ${userId}
               AND deleted_at IS NULL
               AND to_tsvector('italian', coalesce(title, '') || ' ' || content)
                   @@ plainto_tsquery('italian', ${term})
             ORDER BY entry_date DESC
             LIMIT ${request.query.limit ?? 30}`,
      );

      return { items: rows.map((row) => rowToApi('diaryEntries', row) as Diary) };
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['diary'],
        summary: 'Una pagina di diario',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: DiarySchema },
      },
    },
    async (request) => crud.requireById<Diary>('diaryEntries', currentUserId(request), request.params.id),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['diary'],
        summary: 'Scrivi una pagina',
        security: [{ bearerAuth: [] }],
        body: DiaryCreateSchema,
        response: { 201: DiarySchema },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      const created = await crud.create<Diary>('diaryEntries', userId, deviceId, {
        ...request.body,
        entryDate: request.body.entryDate ?? new Date().toISOString().slice(0, 10),
      });

      notifyAfterWrite(userId, deviceId);
      return reply.status(201).send(created);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        tags: ['diary'],
        summary: 'Modifica una pagina',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: DiaryUpdateSchema,
        response: { 200: DiarySchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const updated = await crud.update<Diary>(
        'diaryEntries',
        userId,
        deviceId,
        request.params.id,
        request.body,
      );
      notifyAfterWrite(userId, deviceId);
      return updated;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['diary'],
        summary: 'Elimina una pagina',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      await crud.softDelete<Diary>('diaryEntries', userId, deviceId, request.params.id);
      notifyAfterWrite(userId, deviceId);
      return { ok: true };
    },
  );
};
