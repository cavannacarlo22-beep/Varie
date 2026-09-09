// FILE: backend/src/routes/auth.ts

import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import * as auth from '../services/authService.js';
import { currentUserId, requireAuth, sessionContext } from '../middleware/auth.js';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../services/password.js';
import { RESET_PASSWORD_SCRIPT, resetPasswordPage, resultPage } from './pages.js';

const Email = Type.String({
  format: 'email',
  maxLength: 254,
  description: 'Indirizzo email, non sensibile alle maiuscole.',
});

const Password = Type.String({
  minLength: PASSWORD_MIN_LENGTH,
  maxLength: PASSWORD_MAX_LENGTH,
});

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

const AuthResponse = Type.Object({
  user: PublicUserSchema,
  accessToken: Type.String(),
  refreshToken: Type.String(),
  accessTokenExpiresIn: Type.Integer({ description: 'Durata in secondi dell\'access token.' }),
});

const OkResponse = Type.Object({ ok: Type.Boolean() });

export const authRoutes: FastifyPluginAsyncTypebox = async (app) => {
  // Le rotte di autenticazione hanno un limite più stretto delle altre: sono
  // il bersaglio naturale di chi prova password a raffica.
  await app.register(async (limited) => {
    await limited.register(import('@fastify/rate-limit'), {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
    });

    limited.post(
      '/register',
      {
        schema: {
          tags: ['auth'],
          summary: 'Crea un nuovo account e apre subito una sessione',
          body: Type.Object({
            email: Email,
            password: Password,
            firstName: Type.String({ minLength: 1, maxLength: 80 }),
            lastName: Type.String({ minLength: 1, maxLength: 80 }),
            displayName: Type.Optional(Type.String({ minLength: 1, maxLength: 40 })),
          }),
          response: { 201: AuthResponse },
        },
      },
      async (request, reply) => {
        const result = await auth.register(request.body, sessionContext(request));
        return reply.status(201).send(result);
      },
    );

    limited.post(
      '/login',
      {
        schema: {
          tags: ['auth'],
          summary: 'Accedi con email e password',
          body: Type.Object({
            email: Email,
            password: Type.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
          }),
          response: { 200: AuthResponse },
        },
      },
      async (request) => {
        return auth.login(request.body.email, request.body.password, sessionContext(request));
      },
    );

    limited.post(
      '/forgot-password',
      {
        schema: {
          tags: ['auth'],
          summary: 'Invia il link per reimpostare la password',
          description:
            'Risponde sempre ok, anche se l\'email non è registrata: altrimenti questo endpoint permetterebbe di scoprire chi ha un account.',
          body: Type.Object({ email: Email }),
          response: { 200: OkResponse },
        },
      },
      async (request) => {
        await auth.requestPasswordReset(request.body.email);
        return { ok: true };
      },
    );

    limited.post(
      '/reset-password',
      {
        schema: {
          tags: ['auth'],
          summary: 'Imposta una nuova password usando il token ricevuto per email',
          body: Type.Object({
            token: Type.String({ minLength: 20, maxLength: 200 }),
            newPassword: Password,
          }),
          response: { 200: OkResponse },
        },
      },
      async (request) => {
        await auth.resetPassword(request.body.token, request.body.newPassword);
        return { ok: true };
      },
    );
  });

  // --- Refresh e logout: non richiedono un access token valido -------------

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Ottieni un nuovo access token',
        description:
          'Il refresh token viene ruotato a ogni uso. Se un token già consumato viene ripresentato, tutte le sessioni nate da quel login vengono revocate.',
        body: Type.Object({ refreshToken: Type.String({ minLength: 20, maxLength: 200 }) }),
        response: { 200: AuthResponse },
      },
    },
    async (request) => {
      return auth.refresh(request.body.refreshToken, sessionContext(request));
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Chiude la sessione di questo dispositivo',
        body: Type.Object({ refreshToken: Type.String({ minLength: 20, maxLength: 200 }) }),
        response: { 200: OkResponse },
      },
    },
    async (request) => {
      await auth.logout(request.body.refreshToken);
      return { ok: true };
    },
  );

  // --- Richiedono autenticazione ------------------------------------------

  app.post(
    '/logout-all',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        summary: 'Chiude tutte le sessioni su tutti i dispositivi',
        security: [{ bearerAuth: [] }],
        response: { 200: Type.Object({ ok: Type.Boolean(), revoked: Type.Integer() }) },
      },
    },
    async (request) => {
      const revoked = await auth.logoutEverywhere(currentUserId(request));
      return { ok: true, revoked };
    },
  );

  app.post(
    '/change-password',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        summary: 'Cambia la password (chiude tutte le sessioni)',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          currentPassword: Type.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
          newPassword: Password,
        }),
        response: { 200: OkResponse },
      },
    },
    async (request) => {
      await auth.changePassword(
        currentUserId(request),
        request.body.currentPassword,
        request.body.newPassword,
      );
      return { ok: true };
    },
  );

  app.post(
    '/resend-verification',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        summary: 'Rimanda l\'email di verifica',
        security: [{ bearerAuth: [] }],
        response: { 200: OkResponse },
      },
    },
    async (request) => {
      await auth.resendVerificationEmail(currentUserId(request));
      return { ok: true };
    },
  );

  // --- Pagine aperte dai link nelle email ---------------------------------
  //
  // Questi due endpoint restituiscono HTML perché vengono aperti dal browser
  // quando si clicca il link nell'email. Sono le uniche pagine servite dal
  // backend: tutto il resto è JSON per l'app.

  app.get(
    '/verify-email',
    {
      schema: {
        tags: ['auth'],
        summary: 'Conferma l\'email (pagina aperta dal link ricevuto)',
        querystring: Type.Object({ token: Type.String({ minLength: 10, maxLength: 200 }) }),
        response: { 200: Type.String({ contentMediaType: 'text/html' }) },
      },
    },
    async (request, reply) => {
      try {
        await auth.verifyEmail(request.query.token);
        return reply
          .type('text/html; charset=utf-8')
          .send(
            resultPage(
              'Fatto! 🎉',
              'La tua email è confermata. Puoi tornare nell\'app: ti aspetto lì.',
              true,
            ),
          );
      } catch {
        return reply
          .status(400)
          .type('text/html; charset=utf-8')
          .send(
            resultPage(
              'Questo link non funziona più',
              'Forse è scaduto o l\'hai già usato. Puoi chiederne uno nuovo dalle impostazioni dell\'app.',
              false,
            ),
          );
      }
    },
  );

  app.get(
    '/reset-password',
    {
      schema: {
        tags: ['auth'],
        summary: 'Pagina per scegliere una nuova password (aperta dal link ricevuto)',
        querystring: Type.Object({ token: Type.String({ minLength: 10, maxLength: 200 }) }),
        response: { 200: Type.String({ contentMediaType: 'text/html' }) },
      },
    },
    async (request, reply) => {
      return reply
        .type('text/html; charset=utf-8')
        .send(resetPasswordPage(request.query.token, PASSWORD_MIN_LENGTH));
    },
  );

  app.get(
    '/reset-password.js',
    { schema: { hide: true } },
    async (_request, reply) => {
      return reply
        .type('application/javascript; charset=utf-8')
        .header('Cache-Control', 'public, max-age=3600')
        .send(RESET_PASSWORD_SCRIPT);
    },
  );
};
