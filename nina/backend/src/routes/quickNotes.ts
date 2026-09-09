// FILE: backend/src/routes/quickNotes.ts
//
// "Devo ricordarmi…": il posto dove scrivere una cosa in tre secondi, senza
// decidere data, ora, categoria. Una nota può poi diventare un'attività vera.

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { withTransaction } from '../db/pool.js';
import * as crud from '../repositories/crudRepository.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { deviceIdOf, notifyAfterWrite } from './helpers.js';
import {
  CalendarDate,
  ClientWriteFields,
  IdParam,
  Pagination,
  QuickNoteSchema,
  TaskCategoryEnum,
  TaskSchema,
} from './schemas.js';

type Note = Static<typeof QuickNoteSchema>;
type Task = Static<typeof TaskSchema>;
export const quickNoteRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['notes'],
        summary: 'Le mie note veloci',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ ...Pagination }),
        response: { 200: Type.Object({ items: Type.Array(QuickNoteSchema) }) },
      },
    },
    async (request) => ({
      items: await crud.listForUser<Note>('quickNotes', currentUserId(request), {
        limit: request.query.limit,
        offset: request.query.offset,
      }),
    }),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['notes'],
        summary: 'Scrivi una nota veloce',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          ...ClientWriteFields,
          content: Type.String({ minLength: 1, maxLength: 1000 }),
        }),
        response: { 201: QuickNoteSchema },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const created = await crud.create<Note>('quickNotes', userId, deviceId, request.body);
      notifyAfterWrite(userId, deviceId);
      return reply.status(201).send(created);
    },
  );

  app.post(
    '/:id/to-task',
    {
      schema: {
        tags: ['notes'],
        summary: 'Trasforma una nota in un\'attività',
        description:
          'Crea l\'attività e collega la nota, che resta come traccia di dove è nata la cosa da fare.',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({
          date: Type.Optional(CalendarDate),
          category: Type.Optional(TaskCategoryEnum),
        }),
        response: { 201: TaskSchema },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      const note = await crud.requireById<Note>('quickNotes', userId, request.params.id);

      const task = await withTransaction(async (client) => {
        const created = await crud.create<Task>(
          'tasks',
          userId,
          deviceId,
          {
            title: String(note['content']).slice(0, 200),
            date: request.body.date ?? new Date().toISOString().slice(0, 10),
            category: request.body.category ?? 'PERSONALE',
          },
          client,
        );

        await crud.update<Note>(
          'quickNotes',
          userId,
          deviceId,
          request.params.id,
          { convertedTaskId: created['id'] },
          client,
        );

        return created;
      });

      notifyAfterWrite(userId, deviceId);
      return reply.status(201).send(task);
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['notes'],
        summary: 'Elimina una nota',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      await crud.softDelete<Note>('quickNotes', userId, deviceId, request.params.id);
      notifyAfterWrite(userId, deviceId);
      return { ok: true };
    },
  );
};
