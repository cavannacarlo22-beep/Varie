// FILE: backend/tests/integration/aiuto.ts
//
// Impalcatura dei test di integrazione.
//
// I test girano contro un database vero, non contro finti oggetti: il valore
// di questi test è proprio verificare i vincoli del database, i trigger di
// sincronizzazione e le transazioni, che nessun mock riprodurrebbe.
//
// Ogni file di test parte da un database pulito ricostruito dalle migration:
// così un test non può dipendere da quello che ha lasciato il test precedente.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONI = join(here, '..', '..', 'database', 'migrations');

/** Ricostruisce lo schema da zero applicando le migration in ordine. */
export async function ricreaSchema(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

  const file = (await readdir(MIGRAZIONI)).filter((n) => n.endsWith('.sql')).sort();
  for (const nome of file) {
    await pool.query(await readFile(join(MIGRAZIONI, nome), 'utf8'));
  }
}

export async function avviaApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export interface Sessione {
  token: string;
  refresh: string;
  userId: string;
  email: string;
}

let contatore = 0;

/** Registra un utente nuovo e restituisce la sua sessione. */
export async function registra(
  app: FastifyInstance,
  opzioni: { device?: string; password?: string } = {},
): Promise<Sessione> {
  contatore += 1;
  const email = `prova${contatore}.${Date.now()}@example.com`;
  const password = opzioni.password ?? 'una frase lunga che ricordo';

  const risposta = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'x-nina-device-id': opzioni.device ?? 'dispositivo-di-prova-1' },
    payload: {
      email,
      password,
      firstName: 'Prova',
      lastName: 'Utente',
    },
  });

  if (risposta.statusCode !== 201) {
    throw new Error(`registrazione fallita: ${risposta.statusCode} ${risposta.body}`);
  }

  const corpo = risposta.json();
  return {
    token: corpo.accessToken,
    refresh: corpo.refreshToken,
    userId: corpo.user.id,
    email,
  };
}

/** Scorciatoia per una chiamata autenticata. */
export function chiama(
  app: FastifyInstance,
  sessione: Sessione,
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  payload?: unknown,
  device = 'dispositivo-di-prova-1',
) {
  return app.inject({
    method: metodo,
    url,
    headers: {
      authorization: `Bearer ${sessione.token}`,
      'x-nina-device-id': device,
    },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
}
