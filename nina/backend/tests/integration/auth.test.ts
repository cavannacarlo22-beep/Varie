// FILE: backend/tests/integration/auth.test.ts

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { avviaApp, chiama, registra, ricreaSchema } from './aiuto.js';
import { pool } from '../../src/db/pool.js';

let app: FastifyInstance;

beforeAll(async () => {
  await ricreaSchema();
  app = await avviaApp();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('registrazione', () => {
  it('crea l\'account e apre subito una sessione', async () => {
    const sessione = await registra(app);
    expect(sessione.token).toBeTruthy();
    expect(sessione.refresh).toBeTruthy();
  });

  it('crea anche le impostazioni predefinite', async () => {
    const sessione = await registra(app);
    const risposta = await chiama(app, sessione, 'GET', '/me/settings');

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().darkMode).toBe('SYSTEM');
  });

  it('rifiuta un\'email già registrata', async () => {
    const sessione = await registra(app);

    const risposta = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: sessione.email,
        password: 'una frase lunga che ricordo',
        firstName: 'Altra',
        lastName: 'Persona',
      },
    });

    expect(risposta.statusCode).toBe(409);
    expect(risposta.json().error.code).toBe('EMAIL_ALREADY_USED');
  });

  it('rifiuta una password debole', async () => {
    const risposta = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: `debole${Date.now()}@example.com`,
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
      },
    });

    expect(risposta.statusCode).toBe(400);
  });

  it('normalizza l\'email: maiuscole e spazi non creano un secondo account', async () => {
    const email = `Maiuscole${Date.now()}@Example.COM`;

    const prima = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'una frase lunga che ricordo', firstName: 'A', lastName: 'B' },
    });
    expect(prima.statusCode).toBe(201);

    const seconda = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: email.toLowerCase(),
        password: 'una frase lunga che ricordo',
        firstName: 'A',
        lastName: 'B',
      },
    });
    expect(seconda.statusCode).toBe(409);
  });
});

describe('accesso', () => {
  it('entra con le credenziali giuste', async () => {
    const sessione = await registra(app);

    const risposta = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: sessione.email, password: 'una frase lunga che ricordo' },
    });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().user.email).toBe(sessione.email.toLowerCase());
  });

  it('dà lo stesso errore per email inesistente e password sbagliata', async () => {
    const sessione = await registra(app);

    const passwordSbagliata = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: sessione.email, password: 'una password completamente diversa' },
    });

    const emailInesistente = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nessuno@example.com', password: 'una password completamente diversa' },
    });

    // Se i due casi fossero distinguibili, questo endpoint direbbe a chiunque
    // quali email sono registrate.
    expect(passwordSbagliata.statusCode).toBe(401);
    expect(emailInesistente.statusCode).toBe(401);
    expect(passwordSbagliata.json().error.message).toBe(emailInesistente.json().error.message);
  });
});

describe('token', () => {
  it('rinnova l\'access token e ruota il refresh', async () => {
    const sessione = await registra(app);

    const risposta = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: sessione.refresh },
    });

    expect(risposta.statusCode).toBe(200);
    // Il refresh token restituito è nuovo: quello vecchio è consumato.
    expect(risposta.json().refreshToken).not.toBe(sessione.refresh);
  });

  it('un refresh token riusato chiude tutta la famiglia di sessioni', async () => {
    const sessione = await registra(app);

    // Primo uso: legittimo.
    const primo = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: sessione.refresh },
    });
    expect(primo.statusCode).toBe(200);
    const nuovoRefresh = primo.json().refreshToken;

    // Secondo uso dello stesso token: è la firma di una copia rubata.
    const riuso = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: sessione.refresh },
    });
    expect(riuso.statusCode).toBe(401);
    expect(riuso.json().error.code).toBe('TOKEN_REUSED');

    // E anche il token nato dal primo refresh è stato revocato: l'intera
    // catena cade, non solo quello riusato.
    const dopo = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: nuovoRefresh },
    });
    expect(dopo.statusCode).toBe(401);
  });

  it('senza token le rotte protette rispondono 401', async () => {
    const risposta = await app.inject({ method: 'GET', url: '/tasks' });
    expect(risposta.statusCode).toBe(401);
  });

  it('un token inventato non funziona', async () => {
    const risposta = await app.inject({
      method: 'GET',
      url: '/tasks',
      headers: { authorization: 'Bearer questo-non-e-un-token' },
    });
    expect(risposta.statusCode).toBe(401);
  });
});

describe('password dimenticata', () => {
  it('risponde sempre ok, anche per un\'email inesistente', async () => {
    const risposta = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'proprio-nessuno@example.com' },
    });

    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().ok).toBe(true);
  });
});

describe('cambio password', () => {
  it('cambia la password e chiude tutte le sessioni', async () => {
    const sessione = await registra(app);

    const cambio = await chiama(app, sessione, 'POST', '/auth/change-password', {
      currentPassword: 'una frase lunga che ricordo',
      newPassword: 'una frase nuova che ricordo meglio',
    });
    expect(cambio.statusCode).toBe(200);

    // Il vecchio refresh non vale più.
    const vecchio = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: sessione.refresh },
    });
    expect(vecchio.statusCode).toBe(401);

    // La password nuova funziona.
    const nuovo = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: sessione.email, password: 'una frase nuova che ricordo meglio' },
    });
    expect(nuovo.statusCode).toBe(200);
  });

  it('rifiuta il cambio se la password attuale è sbagliata', async () => {
    const sessione = await registra(app);

    const risposta = await chiama(app, sessione, 'POST', '/auth/change-password', {
      currentPassword: 'non è questa',
      newPassword: 'una frase nuova che ricordo meglio',
    });

    expect(risposta.statusCode).toBe(400);
  });
});
