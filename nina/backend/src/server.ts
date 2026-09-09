// FILE: backend/src/server.ts
//
// Avvio del processo: costruisce l'app, apre la porta e si spegne con ordine.

import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { checkDatabaseConnection, closePool } from './db/pool.js';
import { closeAllStreams } from './realtime/hub.js';
import { startMaintenanceJobs, stopMaintenanceJobs } from './services/maintenance.js';

async function main(): Promise<void> {
  // Meglio scoprire subito che il database non risponde, invece di accettare
  // richieste che falliranno tutte.
  try {
    const { latencyMs } = await checkDatabaseConnection();
    logger.info({ latencyMs }, 'Database raggiungibile');
  } catch (error) {
    logger.fatal(
      { err: error },
      'Non riesco a connettermi al database. Controlla DATABASE_URL nel file .env ' +
        '(su Neon la stringa deve finire con ?sslmode=require).',
    );
    process.exit(1);
  }

  const app = await buildApp();
  startMaintenanceJobs();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Spegnimento in corso');
    stopMaintenanceJobs();
    closeAllStreams();
    try {
      await app.close();
      await closePool();
      logger.info('Spegnimento completato');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Errore durante lo spegnimento');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Promise rifiutata senza gestore');
  });

  await app.listen({ port: config.server.port, host: config.server.host });

  logger.info(
    { url: `http://${config.server.host}:${config.server.port}` },
    config.isProduction ? 'Nina è in ascolto' : 'Nina è in ascolto — documentazione su /docs',
  );
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Avvio fallito');
  process.exit(1);
});
