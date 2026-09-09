// FILE: backend/tests/integration/limiti.test.ts
//
// Il limite di richieste sulle rotte di autenticazione.
//
// Negli altri file i limiti sono alzati (vedi tests/setup.ts), altrimenti ogni
// file si bloccherebbe da solo dopo dieci registrazioni. Qui invece si
// abbassano apposta: è l'unico posto in cui si verifica che il meccanismo
// scatti davvero, e serve proprio perché ovunque altro è disattivato di fatto.
//
// Le variabili d'ambiente vanno impostate *prima* che `config.ts` venga
// valutato, e config viene letto al momento dell'import. Per questo l'app si
// importa dinamicamente qui sotto invece che con un import normale, che
// verrebbe eseguito prima di queste righe.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MASSIMO_AUTH = 3;

process.env['RATE_LIMIT_AUTH_MAX'] = String(MASSIMO_AUTH);
process.env['RATE_LIMIT_MAX'] = '5000';
process.env['RATE_LIMIT_WINDOW'] = '1 minute';

const { avviaApp, chiama, registra, ricreaSchema } = await import('./aiuto.js');
const { pool } = await import('../../src/db/pool.js');
const { config } = await import('../../src/config.js');

type App = Awaited<ReturnType<typeof avviaApp>>;

let app: App;

beforeAll(async () => {
  await ricreaSchema();
  app = await avviaApp();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

function tentaAccesso(email: string) {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: 'quasi certamente sbagliata' },
  });
}

describe('limite sulle rotte di autenticazione', () => {
  it('la configurazione di prova è davvero quella abbassata', () => {
    // Se questo fallisce, tutto il resto del file starebbe misurando il nulla.
    expect(config.rateLimit.authMax).toBe(MASSIMO_AUTH);
  });

  it('blocca i tentativi di accesso a raffica', async () => {
    const stati: number[] = [];
    for (let i = 0; i < MASSIMO_AUTH + 2; i += 1) {
      stati.push((await tentaAccesso('chi.prova@example.com')).statusCode);
    }

    // I primi passano (401: credenziali sbagliate, ma la richiesta è arrivata),
    // gli ultimi no.
    expect(stati.slice(0, MASSIMO_AUTH).every((stato) => stato === 401)).toBe(true);
    expect(stati.slice(MASSIMO_AUTH)).toEqual([429, 429]);
  });

  it('il 429 arriva con un codice che l\'app sa interpretare', async () => {
    const risposta = await tentaAccesso('chi.prova@example.com');

    expect(risposta.statusCode).toBe(429);
    expect(risposta.json().error.code).toBe('RATE_LIMITED');
    // L'header standard dice al client quanto aspettare invece di far
    // indovinare.
    expect(risposta.headers['retry-after']).toBeDefined();
  });

  it('il limite stretto non contagia le rotte normali', async () => {
    // La registrazione è già stata consumata? No: il limite è per rotta, e
    // /auth/register ha il suo contatore separato da /auth/login.
    const sessione = await registra(app);

    // E una rotta qualsiasi dell'app resta perfettamente utilizzabile: sarebbe
    // assurdo che qualche login sbagliato bloccasse anche la lista delle cose
    // da fare.
    for (let i = 0; i < MASSIMO_AUTH + 5; i += 1) {
      const risposta = await chiama(app, sessione, 'GET', '/tasks');
      expect(risposta.statusCode).toBe(200);
    }
  });
});
