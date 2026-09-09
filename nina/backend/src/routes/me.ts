// FILE: backend/src/routes/me.ts

import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { queryRows, sql } from '../db/sql.js';
import * as users from '../repositories/userRepository.js';
import * as crud from '../repositories/crudRepository.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { deviceIdOf, notifyAfterWrite } from './helpers.js';
import { AppError } from '../utils/errors.js';
import { toPublicUser } from '../types/domain.js';
import { verifyPassword } from '../services/password.js';
import { OkSchema, SettingsSchema, SettingsUpdateSchema } from './schemas.js';

const PublicUserSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
  displayName: Type.String(),
  avatarUrl: Type.Union([Type.String(), Type.Null()]),
  role: Type.Union([Type.Literal('USER'), Type.Literal('ADMIN')]),
  isActive: Type.Boolean(),
  emailVerified: Type.Boolean(),
  createdAt: Type.String(),
  lastLoginAt: Type.Union([Type.String(), Type.Null()]),
});

type Settings = Static<typeof SettingsSchema>;
export const meRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/',
    {
      schema: {
        tags: ['me'],
        summary: 'Il mio profilo',
        security: [{ bearerAuth: [] }],
        response: { 200: PublicUserSchema },
      },
    },
    async (request) => {
      const user = await users.findUserById(currentUserId(request));
      if (!user) throw AppError.notFound();
      return toPublicUser(user);
    },
  );

  app.put(
    '/',
    {
      schema: {
        tags: ['me'],
        summary: 'Aggiorna il profilo',
        description: '`displayName` è come Nina ti chiama nell\'app.',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
          lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
          displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 40 })),
          avatarUrl: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
        }),
        response: { 200: PublicUserSchema },
      },
    },
    async (request) => {
      const updated = await users.updateProfile(currentUserId(request), request.body);
      if (!updated) throw AppError.notFound();
      return toPublicUser(updated);
    },
  );

  app.get(
    '/settings',
    {
      schema: {
        tags: ['me'],
        summary: 'Le mie impostazioni',
        security: [{ bearerAuth: [] }],
        response: { 200: SettingsSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const rows = await crud.listForUser<Settings>('userSettings', userId, { limit: 1 });

      const existing = rows[0];
      if (existing) return existing;

      // Un account creato prima dell'introduzione di una nuova impostazione, o
      // un caso limite: si crea al volo con i valori predefiniti.
      await users.createDefaultSettings(userId);
      const created = await crud.listForUser<Settings>('userSettings', userId, { limit: 1 });
      if (!created[0]) throw AppError.internal();
      return created[0];
    },
  );

  app.put(
    '/settings',
    {
      schema: {
        tags: ['me'],
        summary: 'Aggiorna le impostazioni',
        security: [{ bearerAuth: [] }],
        body: SettingsUpdateSchema,
        response: { 200: SettingsSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const deviceId = deviceIdOf(request);

      const current = await crud.listForUser<Settings>('userSettings', userId, { limit: 1 });
      const row = current[0];
      if (!row) {
        await users.createDefaultSettings(userId);
      }

      const settingsId = row
        ? (row['id'] as string)
        : ((await crud.listForUser<Settings>('userSettings', userId, { limit: 1 }))[0]?.['id'] as string);

      const updated = await crud.update<Settings>('userSettings', userId, deviceId, settingsId, request.body);
      notifyAfterWrite(userId, deviceId);
      return updated;
    },
  );

  app.get(
    '/devices',
    {
      schema: {
        tags: ['me'],
        summary: 'I dispositivi collegati al mio account',
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            items: Type.Array(
              Type.Object({
                deviceId: Type.String(),
                name: Type.Union([Type.String(), Type.Null()]),
                platform: Type.Union([Type.String(), Type.Null()]),
                appVersion: Type.Union([Type.String(), Type.Null()]),
                lastSeenAt: Type.String(),
                isCurrent: Type.Boolean(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const current = deviceIdOf(request);

      const rows = await queryRows<{
        device_id: string;
        name: string | null;
        platform: string | null;
        app_version: string | null;
        last_seen_at: Date;
      }>(
        sql`SELECT device_id, name, platform, app_version, last_seen_at
              FROM devices WHERE user_id = ${userId}
             ORDER BY last_seen_at DESC LIMIT 50`,
      );

      return {
        items: rows.map((row) => ({
          deviceId: row.device_id,
          name: row.name,
          platform: row.platform,
          appVersion: row.app_version,
          lastSeenAt: row.last_seen_at.toISOString(),
          isCurrent: row.device_id === current,
        })),
      };
    },
  );

  app.delete(
    '/',
    {
      schema: {
        tags: ['me'],
        summary: 'Elimina definitivamente il mio account e tutti i miei dati',
        description:
          'Richiede la password come conferma. La cancellazione è immediata e irreversibile: ' +
          'attività, abitudini, mood, diario, wishlist e sessioni vengono rimossi dal database, non nascosti.',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          password: Type.String({ minLength: 1, maxLength: 200 }),
          confirm: Type.Literal('ELIMINA IL MIO ACCOUNT', {
            description: 'Conferma testuale esatta, per evitare cancellazioni accidentali.',
          }),
        }),
        response: { 200: OkSchema },
      },
    },
    async (request) => {
      const userId = currentUserId(request);
      const user = await users.findUserById(userId);
      if (!user) throw AppError.notFound();

      const { valid } = await verifyPassword(user.password_hash, request.body.password);
      if (!valid) {
        throw new AppError(400, 'INVALID_CREDENTIALS', 'La password non è corretta.');
      }

      const removed = await users.deleteUserPermanently(userId);
      request.log.info({ removed }, 'Account eliminato su richiesta dell\'utente');

      return { ok: true };
    },
  );

  app.get(
    '/export',
    {
      schema: {
        tags: ['me'],
        summary: 'Scarica tutti i miei dati',
        description:
          'Esporta in JSON tutto ciò che il tuo account contiene. Utile prima di eliminare l\'account.',
        security: [{ bearerAuth: [] }],
        response: { 200: Type.Object({}, { additionalProperties: true }) },
      },
    },
    async (request, reply) => {
      const userId = currentUserId(request);
      const user = await users.findUserById(userId);
      if (!user) throw AppError.notFound();

      const entities = [
        'tasks',
        'habits',
        'habitCompletions',
        'moods',
        'diaryEntries',
        'wishlist',
        'quickNotes',
        'friendMessages',
        'userSettings',
      ] as const;

      const data: Record<string, unknown> = { profile: toPublicUser(user) };

      for (const entity of entities) {
        data[entity] = await crud.listForUser(entity, userId, {
          includeDeleted: false,
          limit: 1000,
        });
      }

      return reply
        .header('Content-Disposition', 'attachment; filename="nina-dati.json"')
        .send({ exportedAt: new Date().toISOString(), ...data });
    },
  );
};
