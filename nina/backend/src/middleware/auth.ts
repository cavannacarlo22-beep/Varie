// FILE: backend/src/middleware/auth.ts
//
// Autenticazione e autorizzazione.
//
// Principio non negoziabile: l'identità dell'utente arriva SOLO dal token.
// Nessuna rotta legge mai uno `userId` dal body o dalla query string. Se
// servisse, sarebbe un modo per leggere i dati di chiunque.

import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../utils/errors.js';
import { verifyAccessToken } from '../services/jwt.js';
import { findUserById } from '../repositories/userRepository.js';
import type { AccessTokenPayload } from '../types/domain.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AccessTokenPayload;
  }
}

function extractBearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;

  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return undefined;
  return token.trim();
}

/** preHandler: richiede un access token valido. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(request);
  if (!token) {
    throw AppError.unauthenticated('Devi accedere per continuare.');
  }

  request.auth = verifyAccessToken(token);
}

/**
 * preHandler: richiede il ruolo ADMIN.
 *
 * Rilegge l'utente dal database invece di fidarsi del ruolo scritto nel token.
 * Costa una query, ma significa che togliere i privilegi a un account ha
 * effetto immediato e non entro i 15 minuti di vita del token. Per le
 * operazioni amministrative è un compromesso che vale la pena.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);

  const auth = request.auth;
  if (!auth) throw AppError.unauthenticated();

  const user = await findUserById(auth.sub);
  if (!user || !user.is_active || user.role !== 'ADMIN') {
    // 404 e non 403: a chi non è admin il pannello non deve nemmeno risultare
    // esistente.
    throw AppError.notFound();
  }
}

/** Restituisce l'id dell'utente autenticato, o solleva un errore. */
export function currentUserId(request: FastifyRequest): string {
  const auth = request.auth;
  if (!auth) throw AppError.unauthenticated();
  return auth.sub;
}

/** Legge i metadati del dispositivo dagli header inviati dall'app. */
export function sessionContext(request: FastifyRequest): {
  deviceId: string | null;
  userAgent: string | null;
  deviceName: string | null;
  platform: string | null;
  appVersion: string | null;
} {
  const header = (name: string): string | null => {
    const value = request.headers[name];
    if (typeof value === 'string' && value.trim() !== '') return value.trim().slice(0, 128);
    return null;
  };

  return {
    deviceId: header('x-nina-device-id'),
    userAgent: header('user-agent'),
    deviceName: header('x-nina-device-name'),
    platform: header('x-nina-platform'),
    appVersion: header('x-nina-app-version'),
  };
}
