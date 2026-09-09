// FILE: backend/src/app.ts
//
// Costruzione dell'applicazione Fastify. Separata da server.ts così i test
// possono creare l'app senza aprire una porta.

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { config } from './config.js';
import { loggerOptions } from './utils/logger.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { checkDatabaseConnection } from './db/pool.js';

import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { taskRoutes } from './routes/tasks.js';
import { habitRoutes } from './routes/habits.js';
import { moodRoutes } from './routes/moods.js';
import { diaryRoutes } from './routes/diary.js';
import { wishlistRoutes } from './routes/wishlist.js';
import { quickNoteRoutes } from './routes/quickNotes.js';
import { contentRoutes } from './routes/content.js';
import { statsRoutes } from './routes/stats.js';
import { syncRoutes } from './routes/sync.js';
import { friendRoutes } from './routes/friend.js';
import { adminRoutes } from './routes/admin.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions,
    // Fidarsi dell'header X-Forwarded-For solo dietro un proxy nostro: serve
    // perché il rate limit veda l'IP vero e non quello del load balancer.
    trustProxy: config.isProduction,
    bodyLimit: 1_048_576, // 1 MB: il diario più lungo del mondo ci sta comodo.
  }).withTypeProvider<TypeBoxTypeProvider>();

  registerErrorHandler(app);

  // --- Sicurezza ------------------------------------------------------------

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        // Le due pagine HTML del backend usano CSS inline; gli script invece
        // stanno in file separati, quindi script-src resta 'self'.
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    // L'app iOS non è un browser: HSTS ha senso solo per le pagine web.
    hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: config.server.corsOrigins.length > 0 ? config.server.corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Nina-Device-Id',
      'X-Nina-Device-Name',
      'X-Nina-Platform',
      'X-Nina-App-Version',
    ],
  });

  // Limite generale. Le rotte di autenticazione ne hanno uno più stretto.
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.finestra,
    // Contare per utente autenticato invece che per IP: due persone sulla
    // stessa rete di casa non si rubano il limite a vicenda.
    keyGenerator: (request) => request.auth?.sub ?? request.ip,
  });

  // --- Documentazione -------------------------------------------------------

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'API di Nina',
        version: '1.0.0',
        description:
          'API dell\'app Nina. Ogni rotta autenticata richiede l\'header ' +
          '`Authorization: Bearer <accessToken>`. L\'access token dura 15 minuti e si ' +
          'rinnova con POST /auth/refresh.',
      },
      servers: [{ url: config.server.publicBaseUrl }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'auth', description: 'Registrazione, accesso, password' },
        { name: 'me', description: 'Profilo e impostazioni' },
        { name: 'tasks', description: 'To Do' },
        { name: 'habits', description: 'Abitudini e completamenti' },
        { name: 'moods', description: 'Mood tracker' },
        { name: 'diary', description: 'Diario privato' },
        { name: 'wishlist', description: 'Wishlist' },
        { name: 'notes', description: 'Note veloci' },
        { name: 'content', description: 'Frasi motivazionali e self care' },
        { name: 'friend', description: 'La mia amica' },
        { name: 'stats', description: 'Statistiche personali' },
        { name: 'sync', description: 'Sincronizzazione fra dispositivi' },
        { name: 'admin', description: 'Solo per amministratori' },
      ],
    },
  });

  if (!config.isProduction) {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });
  }

  // --- Stato ----------------------------------------------------------------

  app.get('/health', { schema: { hide: true } }, async (_request, reply) => {
    try {
      const database = await checkDatabaseConnection();
      return { status: 'ok', database };
    } catch (error) {
      app.log.error({ err: error }, 'Health check: database non raggiungibile');
      return reply.status(503).send({ status: 'degraded', database: { ok: false } });
    }
  });

  // --- Rotte ----------------------------------------------------------------

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(meRoutes, { prefix: '/me' });
  await app.register(taskRoutes, { prefix: '/tasks' });
  await app.register(habitRoutes, { prefix: '/habits' });
  await app.register(moodRoutes, { prefix: '/moods' });
  await app.register(diaryRoutes, { prefix: '/diary' });
  await app.register(wishlistRoutes, { prefix: '/wishlist' });
  await app.register(quickNoteRoutes, { prefix: '/quick-notes' });
  await app.register(contentRoutes);
  await app.register(friendRoutes, { prefix: '/friend' });
  await app.register(statsRoutes, { prefix: '/stats' });
  await app.register(syncRoutes, { prefix: '/sync' });
  await app.register(adminRoutes, { prefix: '/admin' });

  return app;
}
