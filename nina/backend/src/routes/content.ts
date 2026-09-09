// FILE: backend/src/routes/content.ts
//
// Contenuti globali gestiti dall'admin: pensieri del giorno e idee di self care.
//
// Due requisiti guidano il progetto di queste rotte:
//
//  1. il pensiero del giorno dev'essere *stabile*: aprendo l'app tre volte in
//     un giorno si deve leggere la stessa frase, non tre frasi diverse;
//  2. l'app non deve dipendere da internet: esiste un endpoint che scarica
//     tutto il catalogo, così il dispositivo può pescare in locale.

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { execute, queryOne, queryRows, sql } from '../db/sql.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { CalendarDate, IdParam, QuoteSchema, SelfCareCategoryEnum, SelfCareSchema } from './schemas.js';

interface QuoteRow {
  id: string;
  text: string;
  author: string | null;
  source: string | null;
  language: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  is_favorite?: boolean;
}

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

type Quote = Static<typeof QuoteSchema>;
type Idea = Static<typeof SelfCareSchema>;

function toQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    text: row.text,
    author: row.author,
    source: row.source,
    language: row.language,
    isActive: row.is_active,
    isFavorite: row.is_favorite ?? false,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toSelfCare(row: SelfCareRow): Idea {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as Idea['category'],
    durationMin: row.duration_min,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const contentRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  // --- Pensieri del giorno --------------------------------------------------

  app.get(
    '/quotes/daily',
    {
      schema: {
        tags: ['content'],
        summary: 'Il pensiero di oggi',
        description:
          'La frase assegnata a questo utente per questa data. È stabile: la stessa data restituisce sempre la stessa frase.',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ date: Type.Optional(CalendarDate) }),
        response: { 200: QuoteSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const date = request.query.date ?? new Date().toISOString().slice(0, 10);

      // Già assegnata? Restituisci quella.
      const existing = await queryOne<QuoteRow>(
        sql`SELECT q.id, q.text, q.author, q.source, q.language, q.is_active,
                   q.created_at, q.updated_at,
                   EXISTS (SELECT 1 FROM quote_favorites f
                            WHERE f.user_id = ${userId} AND f.quote_id = q.id) AS is_favorite
              FROM daily_quote_assignments a
              JOIN motivation_quotes q ON q.id = a.quote_id
             WHERE a.user_id = ${userId} AND a.date = ${date}`,
      );

      if (existing) return toQuote(existing);

      // Altrimenti sceglie fra le frasi attive, preferendo quelle mai mostrate
      // a questa persona: prima di ripetersi, il catalogo si esaurisce.
      const candidate = await queryOne<QuoteRow>(
        sql`SELECT q.id, q.text, q.author, q.source, q.language, q.is_active,
                   q.created_at, q.updated_at, FALSE AS is_favorite
              FROM motivation_quotes q
              LEFT JOIN daily_quote_assignments a
                     ON a.quote_id = q.id AND a.user_id = ${userId}
             WHERE q.is_active = TRUE
             GROUP BY q.id
             ORDER BY count(a.quote_id) ASC, random()
             LIMIT 1`,
      );

      if (!candidate) {
        throw AppError.notFound('Non ci sono ancora frasi disponibili.');
      }

      // ON CONFLICT: due dispositivi che aprono l'app nello stesso istante non
      // possono ottenere due frasi diverse per lo stesso giorno.
      await execute(
        sql`INSERT INTO daily_quote_assignments (user_id, date, quote_id)
            VALUES (${userId}, ${date}, ${candidate.id})
            ON CONFLICT (user_id, date) DO NOTHING`,
      );

      const assigned = await queryOne<QuoteRow>(
        sql`SELECT q.id, q.text, q.author, q.source, q.language, q.is_active,
                   q.created_at, q.updated_at,
                   EXISTS (SELECT 1 FROM quote_favorites f
                            WHERE f.user_id = ${userId} AND f.quote_id = q.id) AS is_favorite
              FROM daily_quote_assignments a
              JOIN motivation_quotes q ON q.id = a.quote_id
             WHERE a.user_id = ${userId} AND a.date = ${date}`,
      );

      return toQuote(assigned ?? candidate);
    },
  );

  app.get(
    '/quotes/random',
    {
      schema: {
        tags: ['content'],
        summary: 'Un\'altra frase, senza cambiare quella del giorno',
        security: [{ bearerAuth: [] }],
        response: { 200: QuoteSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const row = await queryOne<QuoteRow>(
        sql`SELECT q.id, q.text, q.author, q.source, q.language, q.is_active,
                   q.created_at, q.updated_at,
                   EXISTS (SELECT 1 FROM quote_favorites f
                            WHERE f.user_id = ${userId} AND f.quote_id = q.id) AS is_favorite
              FROM motivation_quotes q
             WHERE q.is_active = TRUE
             ORDER BY random() LIMIT 1`,
      );
      if (!row) throw AppError.notFound('Non ci sono ancora frasi disponibili.');
      return toQuote(row);
    },
  );

  app.get(
    '/quotes',
    {
      schema: {
        tags: ['content'],
        summary: 'Tutte le frasi, per la cache locale',
        description:
          'Con `since` restituisce solo quelle modificate dopo quella data: l\'app aggiorna la sua copia senza riscaricare tutto.',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          since: Type.Optional(Type.String({ minLength: 10, maxLength: 40 })),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, default: 500 })),
        }),
        response: {
          200: Type.Object({ items: Type.Array(QuoteSchema), syncedAt: Type.String() }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const since = request.query.since ?? null;

      const rows = await queryRows<QuoteRow>(
        sql`SELECT q.id, q.text, q.author, q.source, q.language, q.is_active,
                   q.created_at, q.updated_at,
                   EXISTS (SELECT 1 FROM quote_favorites f
                            WHERE f.user_id = ${userId} AND f.quote_id = q.id) AS is_favorite
              FROM motivation_quotes q
             WHERE ${since}::timestamptz IS NULL OR q.updated_at > ${since}::timestamptz
             ORDER BY q.updated_at DESC
             LIMIT ${request.query.limit ?? 500}`,
      );

      return { items: rows.map(toQuote), syncedAt: new Date().toISOString() };
    },
  );

  app.get(
    '/quotes/favorites',
    {
      schema: {
        tags: ['content'],
        summary: 'Le frasi che ho messo tra i preferiti',
        security: [{ bearerAuth: [] }],
        response: { 200: Type.Object({ items: Type.Array(QuoteSchema) }) },
      },
    },
    async (request) => {
      const rows = await queryRows<QuoteRow>(
        sql`SELECT q.id, q.text, q.author, q.source, q.language, q.is_active,
                   q.created_at, q.updated_at, TRUE AS is_favorite
              FROM quote_favorites f
              JOIN motivation_quotes q ON q.id = f.quote_id
             WHERE f.user_id = ${currentUserId(request)}
             ORDER BY f.created_at DESC`,
      );
      return { items: rows.map(toQuote) };
    },
  );

  app.post(
    '/quotes/:id/favorite',
    {
      schema: {
        tags: ['content'],
        summary: 'Aggiungi una frase ai preferiti',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      await execute(
        sql`INSERT INTO quote_favorites (user_id, quote_id)
            VALUES (${currentUserId(request)}, ${request.params.id})
            ON CONFLICT (user_id, quote_id) DO NOTHING`,
      );
      return { ok: true };
    },
  );

  app.delete(
    '/quotes/:id/favorite',
    {
      schema: {
        tags: ['content'],
        summary: 'Togli una frase dai preferiti',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      await execute(
        sql`DELETE FROM quote_favorites
             WHERE user_id = ${currentUserId(request)} AND quote_id = ${request.params.id}`,
      );
      return { ok: true };
    },
  );

  // --- Self care ------------------------------------------------------------

  app.get(
    '/self-care/random',
    {
      schema: {
        tags: ['content'],
        summary: 'Sorprendimi: un\'idea di self care a caso',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          category: Type.Optional(SelfCareCategoryEnum),
          maxMinutes: Type.Optional(Type.Integer({ minimum: 1, maximum: 480 })),
        }),
        response: { 200: SelfCareSchema },
      },
    },
    async (request) => {
      const category = request.query.category ?? null;
      const maxMinutes = request.query.maxMinutes ?? null;

      const row = await queryOne<SelfCareRow>(
        sql`SELECT id, title, description, category, duration_min, is_active, created_at, updated_at
              FROM self_care_ideas
             WHERE is_active = TRUE
               AND (${category}::text IS NULL OR category = ${category})
               AND (${maxMinutes}::int IS NULL
                    OR duration_min IS NULL
                    OR duration_min <= ${maxMinutes})
             ORDER BY random() LIMIT 1`,
      );

      if (!row) throw AppError.notFound('Non ci sono idee che corrispondono a questi filtri.');
      return toSelfCare(row);
    },
  );

  app.get(
    '/self-care',
    {
      schema: {
        tags: ['content'],
        summary: 'Tutte le idee di self care, per la cache locale',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          since: Type.Optional(Type.String({ minLength: 10, maxLength: 40 })),
          category: Type.Optional(SelfCareCategoryEnum),
        }),
        response: {
          200: Type.Object({ items: Type.Array(SelfCareSchema), syncedAt: Type.String() }),
        },
      },
    },
    async (request) => {
      const since = request.query.since ?? null;
      const category = request.query.category ?? null;

      const rows = await queryRows<SelfCareRow>(
        sql`SELECT id, title, description, category, duration_min, is_active, created_at, updated_at
              FROM self_care_ideas
             WHERE (${since}::timestamptz IS NULL OR updated_at > ${since}::timestamptz)
               AND (${category}::text IS NULL OR category = ${category})
             ORDER BY updated_at DESC
             LIMIT 500`,
      );

      return { items: rows.map(toSelfCare), syncedAt: new Date().toISOString() };
    },
  );
};
