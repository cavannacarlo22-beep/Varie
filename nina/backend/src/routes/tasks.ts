// FILE: backend/src/routes/tasks.ts

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { sql } from '../db/sql.js';
import * as crud from '../repositories/crudRepository.js';
import * as taskService from '../services/taskService.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { deviceIdOf, notifyAfterWrite } from './helpers.js';
import {
  CalendarDate,
  IdParam,
  Pagination,
  TaskCreateSchema,
  TaskSchema,
  TaskUpdateSchema,
} from './schemas.js';

type Task = Static<typeof TaskSchema>;
export const taskRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Elenca le attività',
        description:
          'Senza parametri restituisce le attività di oggi. Con `from` e `to` restituisce un intervallo, ' +
          'rifornendo automaticamente le serie ricorrenti che non arrivavano fin lì.',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          date: Type.Optional(CalendarDate),
          from: Type.Optional(CalendarDate),
          to: Type.Optional(CalendarDate),
          includeCompleted: Type.Optional(Type.Boolean({ default: true })),
          ...Pagination,
        }),
        response: { 200: Type.Object({ items: Type.Array(TaskSchema) }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const { date, from, to, includeCompleted, limit, offset } = request.query;

      const conditions = [];
      if (date) {
        conditions.push(sql`date = ${date}`);
      } else if (from || to) {
        if (from) conditions.push(sql`date >= ${from}`);
        if (to) {
          conditions.push(sql`date <= ${to}`);
          // Se l'intervallo richiesto va oltre le occorrenze già generate,
          // le generiamo adesso: le ripetizioni "per sempre" continuano davvero.
          await taskService.topUpSeries(userId, to);
        }
      }
      if (includeCompleted === false) conditions.push(sql`is_completed = FALSE`);

      const items = await crud.listForUser<Task>('tasks', userId, {
        extraConditions: conditions,
        limit,
        offset,
      });

      return { items };
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Una singola attività',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: TaskSchema },
      },
    },
    async (request) => crud.requireById<Task>('tasks', currentUserId(request), request.params.id),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Crea un\'attività',
        description:
          'Se `repeatType` è diverso da NEVER vengono create anche le occorrenze future, legate dalla stessa serie. ' +
          'La risposta contiene la prima occorrenza.',
        security: [{ bearerAuth: [] }],
        body: TaskCreateSchema,
        response: { 201: TaskSchema },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      const created = await taskService.createTask<Task>(userId, deviceId, request.body);
      notifyAfterWrite(userId, deviceId);

      return reply.status(201).send(created);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Modifica un\'attività',
        description: 'Con `?scope=series` la modifica si applica a questa occorrenza e a tutte le successive.',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        querystring: Type.Object({
          scope: Type.Optional(
            Type.Union([Type.Literal('single'), Type.Literal('series')], { default: 'single' }),
          ),
        }),
        body: TaskUpdateSchema,
        response: { 200: TaskSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      if (request.query.scope === 'series') {
        await taskService.updateSeriesFrom(userId, deviceId, request.params.id, request.body);
      } else {
        await crud.update<Task>('tasks', userId, deviceId, request.params.id, request.body);
      }

      notifyAfterWrite(userId, deviceId);
      return crud.requireById<Task>('tasks', userId, request.params.id);
    },
  );

  app.post(
    '/:id/complete',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Segna un\'attività come fatta (o non fatta)',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({ completed: Type.Boolean({ default: true }) }),
        response: { 200: TaskSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const completed = request.body.completed;

      // `completed_at` e `is_completed` devono restare coerenti: un vincolo del
      // database lo impone, quindi si impostano sempre insieme.
      const updated = await crud.update<Task>('tasks', userId, deviceId, request.params.id, {
        isCompleted: completed,
        completedAt: completed ? new Date().toISOString() : null,
      });

      notifyAfterWrite(userId, deviceId);
      return updated;
    },
  );

  app.post(
    '/:id/postpone',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Sposta un\'attività a un altro giorno',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({
          days: Type.Optional(Type.Integer({ minimum: -365, maximum: 365, default: 1 })),
          date: Type.Optional(CalendarDate),
        }),
        response: { 200: TaskSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const existing = await crud.requireById<Task>('tasks', userId, request.params.id);

      let newDate = request.body.date;
      if (!newDate) {
        const base = new Date(`${String(existing['date'])}T12:00:00Z`);
        base.setUTCDate(base.getUTCDate() + (request.body.days ?? 1));
        newDate = base.toISOString().slice(0, 10);
      }

      const updated = await crud.update<Task>('tasks', userId, deviceId, request.params.id, {
        date: newDate,
      });

      notifyAfterWrite(userId, deviceId);
      return updated;
    },
  );

  app.post(
    '/:id/duplicate',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Duplica un\'attività',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({ date: Type.Optional(CalendarDate) }),
        response: { 201: TaskSchema },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const source = await crud.requireById<Task>('tasks', userId, request.params.id);

      const copy = await crud.create<Task>('tasks', userId, deviceId, {
        title: source['title'],
        description: source['description'],
        date: request.body.date ?? source['date'],
        time: source['time'],
        priority: source['priority'],
        category: source['category'],
        notes: source['notes'],
        notificationEnabled: source['notificationEnabled'],
        notificationMinutesBefore: source['notificationMinutesBefore'],
        // La copia non eredita né la ripetizione né lo stato di completamento:
        // è una cosa nuova da fare.
        isCompleted: false,
        completedAt: null,
      });

      notifyAfterWrite(userId, deviceId);
      return reply.status(201).send(copy);
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Elimina un\'attività',
        description: 'Con `?scope=series` elimina anche tutte le occorrenze successive.',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        querystring: Type.Object({
          scope: Type.Optional(
            Type.Union([Type.Literal('single'), Type.Literal('series')], { default: 'single' }),
          ),
        }),
        response: { 200: Type.Object({ ok: Type.Boolean(), deleted: Type.Integer() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      const deleted =
        request.query.scope === 'series'
          ? await taskService.deleteSeriesFrom(userId, deviceId, request.params.id)
          : (await crud.softDelete<Task>('tasks', userId, deviceId, request.params.id), 1);

      notifyAfterWrite(userId, deviceId);
      return { ok: true, deleted };
    },
  );

  app.get(
    '/today/summary',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Riepilogo della giornata, per la Home e i widget',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ date: Type.Optional(CalendarDate) }),
        response: {
          200: Type.Object({
            date: CalendarDate,
            total: Type.Integer(),
            completed: Type.Integer(),
            remaining: Type.Integer(),
            items: Type.Array(TaskSchema),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const date = request.query.date ?? new Date().toISOString().slice(0, 10);

      const items = await crud.listForUser<Task>('tasks', userId, {
        extraConditions: [sql`date = ${date}`],
        limit: 200,
      });

      const completed = items.filter((item) => item['isCompleted'] === true).length;

      return {
        date,
        total: items.length,
        completed,
        remaining: items.length - completed,
        items,
      };
    },
  );
};
