// FILE: backend/src/utils/logger.ts
//
// Logging strutturato con pino (già incluso in Fastify).
//
// La lista `redact` è la parte importante: sono i percorsi che non devono
// finire nei log per nessun motivo. Un log è un file che qualcuno leggerà
// mesi dopo, magari su un servizio esterno: password, token e contenuto del
// diario non devono esserci mai.

import { pino } from 'pino';
import { config } from '../config.js';

const redactPaths = [
  'password',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  // Contenuti privati dell'utente: non sono segreti tecnici, ma non c'è
  // nessuna ragione per cui debbano stare in un log.
  'content',
  'note',
  'notes',
  '*.content',
  'body.content',
  'body.message',
];

export const logger = pino({
  level: config.logging.level,
  redact: {
    paths: redactPaths,
    censor: '[rimosso]',
  },
  // In sviluppo i log leggibili valgono più di quelli indicizzabili.
  transport:
    config.env === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
  base: { service: 'nina-backend' },
});

export const loggerOptions = {
  level: config.logging.level,
  redact: { paths: redactPaths, censor: '[rimosso]' },
};
