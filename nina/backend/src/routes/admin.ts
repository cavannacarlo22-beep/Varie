// FILE: backend/src/routes/admin.ts
//
// Pannello amministratore.
//
// Un principio attraversa tutto il file: **nessun endpoint qui legge contenuti
// privati degli utenti**. Non c'è una rotta che restituisca il testo di una
// pagina di diario, di un messaggio a Nina o di una nota di mood. Non è una
// regola scritta in un commento e poi aggirata: gli endpoint non esistono, e
// le query contano le righe senza selezionarne il contenuto.
//
// Le rotte sono protette da `requireAdmin`, che rilegge il ruolo dal database
// a ogni richiesta invece di fidarsi del token, e risponde 404 a chi non è
// amministratore: il pannello non deve nemmeno risultare esistente.

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { execute, queryOne, queryRows, sql } from '../db/sql.js';
import * as users from '../repositories/userRepository.js';
import { currentUserId, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  IdParam,
  Pagination,
  QuoteSchema,
  SelfCareCategoryEnum,
  SelfCareSchema,
} from './schemas.js';

/** Traccia un'azione amministrativa. Non registra mai contenuti degli utenti. */
async function audit(
  adminId: string,
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await execute(
    sql`INSERT INTO admin_audit_log (admin_id, action, entity, entity_id, metadata)
        VALUES (${adminId}, ${action}, ${entity}, ${entityId}, ${JSON.stringify(metadata)}::jsonb)`,
  );
}

export const adminRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAdmin);

  // --- Utenti ---------------------------------------------------------------

  app.get(
    '/users',
    {
      schema: {
        tags: ['admin'],
        summary: 'Elenco utenti',
        description:
          'Mostra dati di account e conteggi di utilizzo. Il numero di pagine di diario è un conteggio: il contenuto non viene letto.',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          search: Type.Optional(Type.String({ maxLength: 100 })),
          ...Pagination,
        }),
        response: {
          200: Type.Object({
            items: Type.Array(
              Type.Object({
                id: Type.String({ format: 'uuid' }),
                email: Type.String(),
                firstName: Type.String(),
                lastName: Type.String(),
                displayName: Type.String(),
                role: Type.Union([Type.Literal('USER'), Type.Literal('ADMIN')]),
                isActive: Type.Boolean(),
                emailVerified: Type.Boolean(),
                createdAt: Type.String(),
                lastLoginAt: Type.Union([Type.String(), Type.Null()]),
                taskCount: Type.Integer(),
                habitCount: Type.Integer(),
                diaryCount: Type.Integer(),
              }),
            ),
            total: Type.Integer(),
          }),
        },
      },
    },
    async (request) => {
      const rows = await users.listUsersForAdmin(
        request.query.limit ?? 50,
        request.query.offset ?? 0,
        request.query.search ?? null,
      );

      return {
        items: rows.map((row) => ({
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          displayName: row.display_name,
          role: row.role,
          isActive: row.is_active,
          emailVerified: row.email_verified_at !== null,
          createdAt: row.created_at.toISOString(),
          lastLoginAt: row.last_login_at?.toISOString() ?? null,
          taskCount: Number.parseInt(row.task_count, 10),
          habitCount: Number.parseInt(row.habit_count, 10),
          diaryCount: Number.parseInt(row.diary_count, 10),
        })),
        total: await users.countUsers(),
      };
    },
  );

  app.post(
    '/users/:id/active',
    {
      schema: {
        tags: ['admin'],
        summary: 'Attiva o disattiva un account',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({ isActive: Type.Boolean() }),
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      const adminId = currentUserId(request);

      // Disattivare il proprio account chiuderebbe fuori l'unico amministratore.
      if (request.params.id === adminId && !request.body.isActive) {
        throw AppError.validation('Non puoi disattivare il tuo stesso account.');
      }

      const target = await users.findUserById(request.params.id);
      if (!target) throw AppError.notFound('Utente non trovato.');

      await users.setUserActive(request.params.id, request.body.isActive);
      await audit(adminId, request.body.isActive ? 'user.enable' : 'user.disable', 'users', request.params.id);

      return { ok: true };
    },
  );

  // --- Statistiche ----------------------------------------------------------

  app.get(
    '/stats',
    {
      schema: {
        tags: ['admin'],
        summary: 'Statistiche di utilizzo',
        description: 'Solo numeri aggregati. Nessun contenuto privato.',
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            users: Type.Object({
              total: Type.Integer(),
              active: Type.Integer(),
              verified: Type.Integer(),
              newLast7Days: Type.Integer(),
              activeLast7Days: Type.Integer(),
            }),
            content: Type.Object({
              tasks: Type.Integer(),
              tasksCompleted: Type.Integer(),
              habits: Type.Integer(),
              habitCompletions: Type.Integer(),
              moods: Type.Integer(),
              diaryEntries: Type.Integer(),
              wishlistItems: Type.Integer(),
              friendMessages: Type.Integer(),
            }),
            catalog: Type.Object({
              quotes: Type.Integer(),
              quotesActive: Type.Integer(),
              selfCareIdeas: Type.Integer(),
              selfCareActive: Type.Integer(),
            }),
          }),
        },
      },
    },
    async () => {
      const row = await queryOne<Record<string, string>>(
        sql`SELECT
              (SELECT count(*) FROM users)::text                                        AS users_total,
              (SELECT count(*) FROM users WHERE is_active)::text                        AS users_active,
              (SELECT count(*) FROM users WHERE email_verified_at IS NOT NULL)::text    AS users_verified,
              (SELECT count(*) FROM users
                WHERE created_at > now() - INTERVAL '7 days')::text                     AS users_new,
              (SELECT count(*) FROM users
                WHERE last_login_at > now() - INTERVAL '7 days')::text                  AS users_recent,
              (SELECT count(*) FROM tasks WHERE deleted_at IS NULL)::text               AS tasks,
              (SELECT count(*) FROM tasks
                WHERE deleted_at IS NULL AND is_completed)::text                        AS tasks_done,
              (SELECT count(*) FROM habits WHERE deleted_at IS NULL)::text              AS habits,
              (SELECT count(*) FROM habit_completions
                WHERE deleted_at IS NULL AND completed)::text                           AS habit_completions,
              (SELECT count(*) FROM moods WHERE deleted_at IS NULL)::text               AS moods,
              (SELECT count(*) FROM diary_entries WHERE deleted_at IS NULL)::text       AS diary,
              (SELECT count(*) FROM wishlist WHERE deleted_at IS NULL)::text            AS wishlist,
              (SELECT count(*) FROM friend_messages WHERE deleted_at IS NULL)::text     AS friend,
              (SELECT count(*) FROM motivation_quotes)::text                            AS quotes,
              (SELECT count(*) FROM motivation_quotes WHERE is_active)::text            AS quotes_active,
              (SELECT count(*) FROM self_care_ideas)::text                              AS self_care,
              (SELECT count(*) FROM self_care_ideas WHERE is_active)::text              AS self_care_active`,
      );

      const n = (key: string): number => Number.parseInt(row?.[key] ?? '0', 10);

      return {
        users: {
          total: n('users_total'),
          active: n('users_active'),
          verified: n('users_verified'),
          newLast7Days: n('users_new'),
          activeLast7Days: n('users_recent'),
        },
        content: {
          tasks: n('tasks'),
          tasksCompleted: n('tasks_done'),
          habits: n('habits'),
          habitCompletions: n('habit_completions'),
          moods: n('moods'),
          diaryEntries: n('diary'),
          wishlistItems: n('wishlist'),
          friendMessages: n('friend'),
        },
        catalog: {
          quotes: n('quotes'),
          quotesActive: n('quotes_active'),
          selfCareIdeas: n('self_care'),
          selfCareActive: n('self_care_active'),
        },
      };
    },
  );

  // --- Frasi motivazionali --------------------------------------------------

  interface QuoteRow {
    id: string;
    text: string;
    author: string | null;
    source: string | null;
    language: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }

  const toQuote = (row: QuoteRow): Static<typeof QuoteSchema> => ({
    id: row.id,
    text: row.text,
    author: row.author,
    source: row.source,
    language: row.language,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });

  const QUOTE_COLUMNS = sql`id, text, author, source, language, is_active, created_at, updated_at`;

  app.get(
    '/quotes',
    {
      schema: {
        tags: ['admin'],
        summary: 'Elenco delle frasi',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          search: Type.Optional(Type.String({ maxLength: 100 })),
          ...Pagination,
        }),
        response: { 200: Type.Object({ items: Type.Array(QuoteSchema), total: Type.Integer() }) },
      },
    },
    async (request) => {
      const pattern = request.query.search ? `%${request.query.search.toLowerCase()}%` : null;

      const rows = await queryRows<QuoteRow>(
        sql`SELECT ${QUOTE_COLUMNS} FROM motivation_quotes
             WHERE ${pattern}::text IS NULL
                OR lower(text) LIKE ${pattern}
                OR lower(coalesce(author, '')) LIKE ${pattern}
             ORDER BY created_at DESC
             LIMIT ${request.query.limit ?? 100} OFFSET ${request.query.offset ?? 0}`,
      );

      const total = await queryOne<{ count: string }>(
        sql`SELECT count(*)::text AS count FROM motivation_quotes`,
      );

      return { items: rows.map(toQuote), total: Number.parseInt(total?.count ?? '0', 10) };
    },
  );

  app.post(
    '/quotes',
    {
      schema: {
        tags: ['admin'],
        summary: 'Aggiungi una frase',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          text: Type.String({ minLength: 1, maxLength: 500 }),
          author: Type.Optional(Type.Union([Type.String({ maxLength: 120 }), Type.Null()])),
          source: Type.Optional(Type.Union([Type.String({ maxLength: 200 }), Type.Null()])),
          language: Type.Optional(Type.String({ pattern: '^[a-z]{2}$' })),
          isActive: Type.Optional(Type.Boolean()),
        }),
        response: { 201: QuoteSchema },
      },
    },
    async (request, reply) => {
      const row = await queryOne<QuoteRow>(
        sql`INSERT INTO motivation_quotes (text, author, source, language, is_active)
            VALUES (${request.body.text}, ${request.body.author ?? null},
                    ${request.body.source ?? null}, ${request.body.language ?? 'it'},
                    ${request.body.isActive ?? true})
            RETURNING ${QUOTE_COLUMNS}`,
      );
      if (!row) throw AppError.internal();

      await audit(currentUserId(request), 'quote.create', 'motivation_quotes', row.id);
      return reply.status(201).send(toQuote(row));
    },
  );

  app.put(
    '/quotes/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Modifica una frase',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({
          text: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
          author: Type.Optional(Type.Union([Type.String({ maxLength: 120 }), Type.Null()])),
          source: Type.Optional(Type.Union([Type.String({ maxLength: 200 }), Type.Null()])),
          language: Type.Optional(Type.String({ pattern: '^[a-z]{2}$' })),
          isActive: Type.Optional(Type.Boolean()),
        }),
        response: { 200: QuoteSchema },
      },
    },
    async (request) => {
      const body = request.body;

      const row = await queryOne<QuoteRow>(
        sql`UPDATE motivation_quotes
               SET text      = COALESCE(${body.text ?? null}, text),
                   author    = CASE WHEN ${body.author === undefined} THEN author
                                    ELSE ${body.author ?? null} END,
                   source    = CASE WHEN ${body.source === undefined} THEN source
                                    ELSE ${body.source ?? null} END,
                   language  = COALESCE(${body.language ?? null}, language),
                   is_active = COALESCE(${body.isActive ?? null}, is_active)
             WHERE id = ${request.params.id}
            RETURNING ${QUOTE_COLUMNS}`,
      );

      if (!row) throw AppError.notFound('Frase non trovata.');
      await audit(currentUserId(request), 'quote.update', 'motivation_quotes', row.id);
      return toQuote(row);
    },
  );

  app.delete(
    '/quotes/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Elimina una frase',
        description:
          'Se la frase è già stata mostrata a qualcuno viene solo disattivata, così lo storico resta coerente.',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: {
          200: Type.Object({ ok: Type.Boolean(), deactivatedInstead: Type.Boolean() }),
        },
      },
    },
    async (request) => {
      const used = await queryOne<{ count: string }>(
        sql`SELECT count(*)::text AS count FROM daily_quote_assignments
             WHERE quote_id = ${request.params.id}`,
      );

      const alreadyShown = Number.parseInt(used?.count ?? '0', 10) > 0;

      if (alreadyShown) {
        await execute(
          sql`UPDATE motivation_quotes SET is_active = FALSE WHERE id = ${request.params.id}`,
        );
      } else {
        const removed = await execute(
          sql`DELETE FROM motivation_quotes WHERE id = ${request.params.id}`,
        );
        if (removed === 0) throw AppError.notFound('Frase non trovata.');
      }

      await audit(currentUserId(request), 'quote.delete', 'motivation_quotes', request.params.id, {
        deactivatedInstead: alreadyShown,
      });

      return { ok: true, deactivatedInstead: alreadyShown };
    },
  );

  // --- Idee di self care ----------------------------------------------------

  interface SelfCareRow {
    id: string;
    title: string;
    description: string | null;
    category: string;
    duration_min: number | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }

  const toIdea = (row: SelfCareRow): Static<typeof SelfCareSchema> => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as Static<typeof SelfCareCategoryEnum>,
    durationMin: row.duration_min,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });

  const IDEA_COLUMNS = sql`id, title, description, category, duration_min, is_active, created_at, updated_at`;

  app.get(
    '/self-care',
    {
      schema: {
        tags: ['admin'],
        summary: 'Elenco delle idee di self care',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ ...Pagination }),
        response: {
          200: Type.Object({ items: Type.Array(SelfCareSchema), total: Type.Integer() }),
        },
      },
    },
    async (request) => {
      const rows = await queryRows<SelfCareRow>(
        sql`SELECT ${IDEA_COLUMNS} FROM self_care_ideas
             ORDER BY created_at DESC
             LIMIT ${request.query.limit ?? 100} OFFSET ${request.query.offset ?? 0}`,
      );
      const total = await queryOne<{ count: string }>(
        sql`SELECT count(*)::text AS count FROM self_care_ideas`,
      );
      return { items: rows.map(toIdea), total: Number.parseInt(total?.count ?? '0', 10) };
    },
  );

  app.post(
    '/self-care',
    {
      schema: {
        tags: ['admin'],
        summary: 'Aggiungi un\'idea di self care',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          title: Type.String({ minLength: 1, maxLength: 200 }),
          description: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
          category: SelfCareCategoryEnum,
          durationMin: Type.Optional(
            Type.Union([Type.Integer({ minimum: 1, maximum: 480 }), Type.Null()]),
          ),
          isActive: Type.Optional(Type.Boolean()),
        }),
        response: { 201: SelfCareSchema },
      },
    },
    async (request, reply) => {
      const row = await queryOne<SelfCareRow>(
        sql`INSERT INTO self_care_ideas (title, description, category, duration_min, is_active)
            VALUES (${request.body.title}, ${request.body.description ?? null},
                    ${request.body.category}, ${request.body.durationMin ?? null},
                    ${request.body.isActive ?? true})
            RETURNING ${IDEA_COLUMNS}`,
      );
      if (!row) throw AppError.internal();

      await audit(currentUserId(request), 'selfcare.create', 'self_care_ideas', row.id);
      return reply.status(201).send(toIdea(row));
    },
  );

  app.put(
    '/self-care/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Modifica un\'idea di self care',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({
          title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
          description: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
          category: Type.Optional(SelfCareCategoryEnum),
          durationMin: Type.Optional(
            Type.Union([Type.Integer({ minimum: 1, maximum: 480 }), Type.Null()]),
          ),
          isActive: Type.Optional(Type.Boolean()),
        }),
        response: { 200: SelfCareSchema },
      },
    },
    async (request) => {
      const body = request.body;

      const row = await queryOne<SelfCareRow>(
        sql`UPDATE self_care_ideas
               SET title        = COALESCE(${body.title ?? null}, title),
                   description  = CASE WHEN ${body.description === undefined} THEN description
                                       ELSE ${body.description ?? null} END,
                   category     = COALESCE(${body.category ?? null}, category),
                   duration_min = CASE WHEN ${body.durationMin === undefined} THEN duration_min
                                       ELSE ${body.durationMin ?? null} END,
                   is_active    = COALESCE(${body.isActive ?? null}, is_active)
             WHERE id = ${request.params.id}
            RETURNING ${IDEA_COLUMNS}`,
      );

      if (!row) throw AppError.notFound('Idea non trovata.');
      await audit(currentUserId(request), 'selfcare.update', 'self_care_ideas', row.id);
      return toIdea(row);
    },
  );

  app.delete(
    '/self-care/:id',
    {
      schema: {
        tags: ['admin'],
        summary: 'Elimina un\'idea di self care',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      const removed = await execute(
        sql`DELETE FROM self_care_ideas WHERE id = ${request.params.id}`,
      );
      if (removed === 0) throw AppError.notFound('Idea non trovata.');

      await audit(currentUserId(request), 'selfcare.delete', 'self_care_ideas', request.params.id);
      return { ok: true };
    },
  );

  // --- Registro delle azioni ------------------------------------------------

  app.get(
    '/audit',
    {
      schema: {
        tags: ['admin'],
        summary: 'Registro delle azioni amministrative',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ ...Pagination }),
        response: {
          200: Type.Object({
            items: Type.Array(
              Type.Object({
                id: Type.String(),
                adminEmail: Type.Union([Type.String(), Type.Null()]),
                action: Type.String(),
                entity: Type.String(),
                entityId: Type.Union([Type.String(), Type.Null()]),
                createdAt: Type.String(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => {
      const rows = await queryRows<{
        id: string;
        admin_email: string | null;
        action: string;
        entity: string;
        entity_id: string | null;
        created_at: Date;
      }>(
        sql`SELECT l.id, u.email AS admin_email, l.action, l.entity, l.entity_id, l.created_at
              FROM admin_audit_log l
              LEFT JOIN users u ON u.id = l.admin_id
             ORDER BY l.created_at DESC
             LIMIT ${request.query.limit ?? 100} OFFSET ${request.query.offset ?? 0}`,
      );

      return {
        items: rows.map((row) => ({
          id: row.id,
          adminEmail: row.admin_email,
          action: row.action,
          entity: row.entity,
          entityId: row.entity_id,
          createdAt: row.created_at.toISOString(),
        })),
      };
    },
  );
};
