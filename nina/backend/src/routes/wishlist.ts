// FILE: backend/src/routes/wishlist.ts

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { queryOne, sql } from '../db/sql.js';
import * as crud from '../repositories/crudRepository.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { deviceIdOf, notifyAfterWrite } from './helpers.js';
import {
  IdParam,
  Pagination,
  WishlistCategoryEnum,
  WishlistCreateSchema,
  WishlistSchema,
  WishlistUpdateSchema,
} from './schemas.js';

type Wish = Static<typeof WishlistSchema>;
export const wishlistRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'La mia wishlist, con il valore totale',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          category: Type.Optional(WishlistCategoryEnum),
          purchased: Type.Optional(Type.Boolean()),
          ...Pagination,
        }),
        response: {
          200: Type.Object({
            items: Type.Array(WishlistSchema),
            totalValue: Type.Number({ description: 'Somma dei desideri non ancora acquistati.' }),
            purchasedValue: Type.Number(),
            currency: Type.String(),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);

      const conditions = [];
      if (request.query.category) conditions.push(sql`category = ${request.query.category}`);
      if (request.query.purchased !== undefined) {
        conditions.push(sql`is_purchased = ${request.query.purchased}`);
      }

      const items = await crud.listForUser<Wish>('wishlist', userId, {
        extraConditions: conditions,
        limit: request.query.limit,
        offset: request.query.offset,
      });

      // I totali si calcolano nel database e non sull'elenco paginato:
      // altrimenti il totale cambierebbe scorrendo la pagina.
      const totals = await queryOne<{ wanted: string; bought: string; currency: string | null }>(
        sql`SELECT COALESCE(SUM(price) FILTER (WHERE is_purchased = FALSE), 0)::text AS wanted,
                   COALESCE(SUM(price) FILTER (WHERE is_purchased = TRUE),  0)::text AS bought,
                   MIN(currency) AS currency
              FROM wishlist
             WHERE user_id = ${userId} AND deleted_at IS NULL`,
      );

      return {
        items,
        totalValue: Number.parseFloat(totals?.wanted ?? '0'),
        purchasedValue: Number.parseFloat(totals?.bought ?? '0'),
        currency: totals?.currency ?? 'EUR',
      };
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Aggiungi un desiderio',
        security: [{ bearerAuth: [] }],
        body: WishlistCreateSchema,
        response: { 201: WishlistSchema },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const created = await crud.create<Wish>('wishlist', userId, deviceId, request.body);
      notifyAfterWrite(userId, deviceId);
      return reply.status(201).send(created);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Modifica un desiderio',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: WishlistUpdateSchema,
        response: { 200: WishlistSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const updated = await crud.update<Wish>(
        'wishlist',
        userId,
        deviceId,
        request.params.id,
        request.body,
      );
      notifyAfterWrite(userId, deviceId);
      return updated;
    },
  );

  app.post(
    '/:id/purchased',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Segna un desiderio come acquistato',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: Type.Object({ purchased: Type.Boolean({ default: true }) }),
        response: { 200: WishlistSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      const purchased = request.body.purchased;

      const updated = await crud.update<Wish>('wishlist', userId, deviceId, request.params.id, {
        isPurchased: purchased,
        purchasedAt: purchased ? new Date().toISOString() : null,
      });

      notifyAfterWrite(userId, deviceId);
      return updated;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['wishlist'],
        summary: 'Elimina un desiderio',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }) },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);
      await crud.softDelete<Wish>('wishlist', userId, deviceId, request.params.id);
      notifyAfterWrite(userId, deviceId);
      return { ok: true };
    },
  );
};
