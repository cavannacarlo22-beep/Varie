// FILE: backend/src/routes/sync.ts
//
// Le tre rotte che tengono allineati iPhone e iPad.

import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { config } from '../config.js';
import * as sync from '../repositories/syncRepository.js';
import { SYNC_ENTITY_NAMES, isSyncEntity } from '../repositories/entities.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { addSubscriber, notifyUser, subscriberCount } from '../realtime/hub.js';
import { deviceIdOf } from './helpers.js';
import { AppError } from '../utils/errors.js';
import { IsoDateTime, Uuid } from './schemas.js';

const EntityEnum = Type.Union(SYNC_ENTITY_NAMES.map((name) => Type.Literal(name)));

const ChangeSchema = Type.Object({
  entity: EntityEnum,
  data: Type.Object({}, { additionalProperties: true }),
});

export const syncRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/cursor',
    {
      schema: {
        tags: ['sync'],
        summary: 'Il valore attuale del cursore',
        description:
          'Utile a un dispositivo appena installato che vuole sapere dove si trova prima di scaricare tutto.',
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({ cursor: Type.Integer(), connectedDevices: Type.Integer() }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      return {
        cursor: await sync.currentCursor(userId),
        connectedDevices: subscriberCount(userId),
      };
    },
  );

  app.get(
    '/changes',
    {
      schema: {
        tags: ['sync'],
        summary: 'Tutto ciò che è cambiato dopo il cursore',
        description:
          'Con `since=0` restituisce l\'intero contenuto dell\'account: è il primo avvio su un nuovo dispositivo. ' +
          'Se `hasMore` è vero, richiama con il nuovo `cursor` finché non diventa falso.',
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          since: Type.Integer({ minimum: 0, default: 0 }),
          limit: Type.Optional(
            Type.Integer({ minimum: 1, maximum: config.sync.maxChangesPerPage, default: 200 }),
          ),
        }),
        response: {
          200: Type.Object({
            changes: Type.Array(ChangeSchema),
            cursor: Type.Integer(),
            hasMore: Type.Boolean(),
          }),
        },
      },
    },
    async (request) => {
      return sync.pullChanges(
        currentUserId(request),
        request.query.since,
        request.query.limit ?? 200,
      );
    },
  );

  app.post(
    '/push',
    {
      schema: {
        tags: ['sync'],
        summary: 'Invia le modifiche fatte offline',
        description:
          'Ogni elemento riceve un esito: `applied` se accettato, `rejected` se sul server c\'era già una versione più recente. ' +
          'In entrambi i casi la risposta contiene lo stato autorevole, che il dispositivo adotta. Nessuna modifica viene persa in silenzio.',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          changes: Type.Array(
            Type.Object({
              entity: EntityEnum,
              id: Uuid,
              baseVersion: Type.Optional(Type.Integer({ minimum: 0 })),
              clientUpdatedAt: IsoDateTime,
              data: Type.Object({}, { additionalProperties: true }),
            }),
            { maxItems: config.sync.maxPushBatch },
          ),
        }),
        response: {
          200: Type.Object({
            results: Type.Array(
              Type.Object({
                entity: EntityEnum,
                id: Uuid,
                outcome: Type.Union([
                  Type.Literal('applied'),
                  Type.Literal('rejected'),
                  Type.Literal('ignored'),
                ]),
                server: Type.Union([Type.Object({}, { additionalProperties: true }), Type.Null()]),
                reason: Type.Optional(Type.String()),
              }),
            ),
            cursor: Type.Integer(),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      const items = request.body.changes.map((change) => {
        if (!isSyncEntity(change.entity)) {
          throw AppError.validation(`Entità sconosciuta: ${change.entity}`);
        }
        return {
          entity: change.entity,
          id: change.id,
          baseVersion: change.baseVersion,
          clientUpdatedAt: change.clientUpdatedAt,
          data: change.data as Record<string, unknown>,
        };
      });

      const result = await sync.pushChanges(userId, deviceId, items);

      // Avvisa gli altri dispositivi solo se qualcosa è davvero cambiato.
      if (result.results.some((item) => item.outcome === 'applied')) {
        notifyUser(userId, result.cursor, deviceId);
      }

      return result;
    },
  );

  app.get(
    '/stream',
    {
      schema: {
        tags: ['sync'],
        summary: 'Flusso di eventi in tempo reale (Server-Sent Events)',
        description:
          'Tiene aperta una connessione e invia `event: changed` quando qualcosa cambia su un altro dispositivo. ' +
          'L\'evento contiene solo il nuovo cursore: i dati si leggono con GET /sync/changes. ' +
          'Se la connessione cade, il client riprende da dove era: nessun dato dipende dal fatto che questo flusso sia attivo.',
        security: [{ bearerAuth: [] }],
        produces: ['text/event-stream'],
        response: { 200: Type.String() },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const cursor = await sync.currentCursor(userId);

      const unsubscribe = addSubscriber(userId, reply, cursor);

      request.raw.on('close', unsubscribe);
      request.raw.on('error', unsubscribe);

      // Fastify non deve considerare conclusa la risposta: lo stream resta
      // aperto finché il client non chiude.
      return reply;
    },
  );
};
