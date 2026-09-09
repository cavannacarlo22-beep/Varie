// FILE: backend/src/routes/helpers.ts

import type { FastifyRequest } from 'fastify';
import { currentCursor } from '../repositories/syncRepository.js';
import { notifyUser } from '../realtime/hub.js';
import { logger } from '../utils/logger.js';

/** Id del dispositivo che ha fatto la richiesta, se lo ha dichiarato. */
export function deviceIdOf(request: FastifyRequest): string | null {
  const value = request.headers['x-nina-device-id'];
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, 128) : null;
}

/**
 * Avvisa gli altri dispositivi dell'utente che qualcosa è cambiato.
 *
 * Volutamente "fire and forget": se la notifica fallisce, la modifica è
 * comunque salvata e il prossimo pull la troverà. Non ha senso far fallire
 * una richiesta riuscita perché una notifica non è partita.
 */
export function notifyAfterWrite(userId: string, deviceId: string | null): void {
  void currentCursor(userId)
    .then((cursor) => notifyUser(userId, cursor, deviceId))
    .catch((error: unknown) => {
      logger.debug({ err: error, userId }, 'Notifica realtime non inviata');
    });
}
