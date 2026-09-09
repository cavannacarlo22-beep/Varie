// FILE: backend/src/routes/friend.ts
//
// "La mia amica 💗"

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { queryOne, sql } from '../db/sql.js';
import * as crud from '../repositories/crudRepository.js';
import { findUserById } from '../repositories/userRepository.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { deviceIdOf, notifyAfterWrite } from './helpers.js';
import { generateFriendReply, friendEngineInfo, type FriendTurn } from '../services/aiService.js';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
import { FriendMessageSchema, Pagination } from './schemas.js';

type Message = Static<typeof FriendMessageSchema>;
export const friendRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/messages',
    {
      schema: {
        tags: ['friend'],
        summary: 'La conversazione con Nina',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ ...Pagination }),
        response: { 200: Type.Object({ items: Type.Array(FriendMessageSchema) }) },
      },
    },
    async (request) => ({
      items: await crud.listForUser<Message>('friendMessages', currentUserId(request), {
        limit: request.query.limit ?? 100,
        offset: request.query.offset,
      }),
    }),
  );

  app.get(
    '/status',
    {
      schema: {
        tags: ['friend'],
        summary: 'Come sta rispondendo Nina',
        description:
          'Dice se le risposte arrivano da un modello linguistico o dal motore conversazionale incluso nel backend.',
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            engine: Type.Union([Type.Literal('ai'), Type.Literal('locale')]),
            topics: Type.Integer(),
            dailyLimit: Type.Integer(),
            usedToday: Type.Integer(),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const info = friendEngineInfo();

      const used = await queryOne<{ count: string }>(
        sql`SELECT count(*)::text AS count FROM friend_messages
             WHERE user_id = ${userId} AND author = 'USER'
               AND created_at >= date_trunc('day', now())`,
      );

      return {
        ...info,
        // Il limite vale solo per il modello a pagamento: il motore locale non
        // costa niente, quindi non c'è ragione di limitarlo.
        dailyLimit: info.engine === 'ai' ? config.ai.dailyMessageLimit : 0,
        usedToday: Number.parseInt(used?.count ?? '0', 10),
      };
    },
  );

  app.post(
    '/messages',
    {
      schema: {
        tags: ['friend'],
        summary: 'Scrivi a Nina',
        description:
          'Salva il messaggio, genera la risposta e salva anche quella. Restituisce entrambi, così l\'app li mostra in ordine.',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          content: Type.String({ minLength: 1, maxLength: 4000 }),
          /** Ora locale del dispositivo: il server non può indovinare il fuso. */
          hour: Type.Optional(Type.Integer({ minimum: 0, maximum: 23 })),
        }),
        response: {
          200: Type.Object({
            message: FriendMessageSchema,
            reply: FriendMessageSchema,
            source: Type.Union([
              Type.Literal('ai'),
              Type.Literal('fallback'),
              Type.Literal('safety'),
            ]),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      const user = await findUserById(userId);
      if (!user) throw AppError.notFound();

      const info = friendEngineInfo();

      // Il tetto giornaliero protegge da una bolletta a sorpresa, e si applica
      // solo quando le risposte costano davvero.
      if (info.engine === 'ai') {
        const used = await queryOne<{ count: string }>(
          sql`SELECT count(*)::text AS count FROM friend_messages
               WHERE user_id = ${userId} AND author = 'USER'
                 AND created_at >= date_trunc('day', now())`,
        );

        if (Number.parseInt(used?.count ?? '0', 10) >= config.ai.dailyMessageLimit) {
          throw new AppError(
            429,
            'AI_DAILY_LIMIT',
            'Abbiamo chiacchierato tantissimo oggi 😅 Ci risentiamo domani?',
          );
        }
      }

      const history = await crud.listForUser<Message>('friendMessages', userId, {
        limit: 40,
        orderOverride: 'created_at DESC',
      });

      const saved = await crud.create<Message>('friendMessages', userId, deviceId, {
        author: 'USER',
        content: request.body.content,
      });

      const turns: FriendTurn[] = [
        ...history
          .slice()
          .reverse()
          .map((row) => ({
            author: row['author'] as 'USER' | 'NINA',
            content: String(row['content']),
          })),
        { author: 'USER', content: request.body.content },
      ];

      const answer = await generateFriendReply(turns, {
        userName: user.display_name,
        hour: request.body.hour ?? new Date().getHours(),
      });

      const reply = await crud.create<Message>('friendMessages', userId, deviceId, {
        author: 'NINA',
        content: answer.text,
      });

      notifyAfterWrite(userId, deviceId);

      return { message: saved, reply, source: answer.source };
    },
  );

  app.delete(
    '/messages',
    {
      schema: {
        tags: ['friend'],
        summary: 'Cancella tutta la conversazione',
        security: [{ bearerAuth: [] }],
        response: { 200: Type.Object({ ok: Type.Boolean(), deleted: Type.Integer() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      const all = await crud.listForUser<Message>('friendMessages', userId, { limit: 1000 });
      for (const message of all) {
        await crud.softDelete<Message>('friendMessages', userId, deviceId, message['id'] as string);
      }

      notifyAfterWrite(userId, deviceId);
      return { ok: true, deleted: all.length };
    },
  );
};
