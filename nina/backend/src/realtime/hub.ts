// FILE: backend/src/realtime/hub.ts
//
// Notifiche in tempo reale via Server-Sent Events.
//
// L'evento NON contiene i dati: contiene solo il nuovo valore del cursore.
// Il client, ricevendolo, fa una normale `GET /sync/changes?since=…`.
//
// Sembra un giro in più, ma è la scelta che tiene insieme tutto: esiste un solo
// percorso di lettura dei dati, quindi realtime e offline non possono
// divergere. Se un evento si perde — rete mobile, app in background, riavvio
// del server — la prossima sincronizzazione recupera comunque tutto. Il
// realtime accelera l'aggiornamento, non ne è responsabile.

import type { FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

interface Subscriber {
  id: number;
  userId: string;
  reply: FastifyReply;
}

const subscribersByUser = new Map<string, Set<Subscriber>>();
let nextSubscriberId = 1;

/** Ogni 25 secondi un commento SSE tiene viva la connessione. */
const HEARTBEAT_MS = 25_000;
let heartbeatTimer: NodeJS.Timeout | undefined;

function ensureHeartbeat(): void {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    for (const subscribers of subscribersByUser.values()) {
      for (const subscriber of subscribers) {
        try {
          subscriber.reply.raw.write(': ping\n\n');
        } catch {
          removeSubscriber(subscriber);
        }
      }
    }
  }, HEARTBEAT_MS);

  // Il timer non deve impedire al processo di chiudersi.
  heartbeatTimer.unref();
}

function removeSubscriber(subscriber: Subscriber): void {
  const set = subscribersByUser.get(subscriber.userId);
  if (!set) return;

  set.delete(subscriber);
  if (set.size === 0) subscribersByUser.delete(subscriber.userId);
}

/**
 * Registra un dispositivo in ascolto. Restituisce la funzione per disiscriverlo.
 */
export function addSubscriber(userId: string, reply: FastifyReply, currentCursor: number): () => void {
  const subscriber: Subscriber = { id: nextSubscriberId++, userId, reply };

  let set = subscribersByUser.get(userId);
  if (!set) {
    set = new Set();
    subscribersByUser.set(userId, set);
  }
  set.add(subscriber);
  ensureHeartbeat();

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disattiva il buffering di nginx, che altrimenti trattiene gli eventi.
    'X-Accel-Buffering': 'no',
  });

  // Primo evento: dice subito al client dove siamo, così può recuperare
  // quello che si è perso mentre era offline.
  reply.raw.write(`retry: 5000\n`);
  reply.raw.write(`event: hello\ndata: ${JSON.stringify({ cursor: currentCursor })}\n\n`);

  logger.debug({ userId, subscribers: set.size }, 'Dispositivo connesso allo stream');

  return () => {
    removeSubscriber(subscriber);
    logger.debug({ userId }, 'Dispositivo disconnesso dallo stream');
  };
}

/**
 * Avvisa tutti i dispositivi di un utente che c'è qualcosa di nuovo.
 *
 * `originDeviceId` è il dispositivo che ha fatto la modifica: non ha senso
 * svegliarlo per dirgli quello che ha appena fatto lui.
 */
export function notifyUser(userId: string, cursor: number, originDeviceId?: string | null): void {
  const subscribers = subscribersByUser.get(userId);
  if (!subscribers || subscribers.size === 0) return;

  const payload = `event: changed\ndata: ${JSON.stringify({ cursor, origin: originDeviceId ?? null })}\n\n`;

  for (const subscriber of subscribers) {
    try {
      subscriber.reply.raw.write(payload);
    } catch (error) {
      logger.debug({ err: error, userId }, 'Scrittura sullo stream fallita, rimuovo il client');
      removeSubscriber(subscriber);
    }
  }
}

export function subscriberCount(userId?: string): number {
  if (userId) return subscribersByUser.get(userId)?.size ?? 0;
  let total = 0;
  for (const set of subscribersByUser.values()) total += set.size;
  return total;
}

/** Chiude tutti gli stream: usata allo spegnimento del server. */
export function closeAllStreams(): void {
  for (const subscribers of subscribersByUser.values()) {
    for (const subscriber of subscribers) {
      try {
        subscriber.reply.raw.end();
      } catch {
        // Lo stream era già chiuso: niente da fare.
      }
    }
  }
  subscribersByUser.clear();

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
}
