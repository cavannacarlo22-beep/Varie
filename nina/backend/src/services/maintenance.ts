// FILE: backend/src/services/maintenance.ts
//
// Pulizie periodiche.
//
// Girano dentro il processo del server invece che come cron esterni: sono
// operazioni leggere, e così non c'è niente in più da configurare al deploy.
// Se un giorno servissero garanzie più forti (più istanze del backend che non
// devono duplicare il lavoro), il posto giusto sarebbe un lock nel database.

import { deleteExpiredTokens } from '../repositories/tokenRepository.js';
import { purgeDeleted } from '../repositories/crudRepository.js';
import { SYNC_ENTITY_NAMES } from '../repositories/entities.js';
import { logger } from '../utils/logger.js';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | undefined;

async function runOnce(): Promise<void> {
  try {
    const tokens = await deleteExpiredTokens();

    let purged = 0;
    for (const entity of SYNC_ENTITY_NAMES) {
      purged += await purgeDeleted(entity);
    }

    if (tokens > 0 || purged > 0) {
      logger.info({ tokens, purged }, 'Pulizia periodica completata');
    }
  } catch (error) {
    // Una pulizia fallita non è un problema urgente: si ritenta fra sei ore.
    logger.error({ err: error }, 'Pulizia periodica fallita');
  }
}

export function startMaintenanceJobs(): void {
  if (timer) return;

  // Prima esecuzione dopo un minuto, per non rallentare l'avvio.
  setTimeout(() => void runOnce(), 60_000).unref();

  timer = setInterval(() => void runOnce(), SIX_HOURS_MS);
  timer.unref();
}

export function stopMaintenanceJobs(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = undefined;
}
