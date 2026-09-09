// FILE: backend/tests/integration/sync.test.ts
//
// La sincronizzazione fra iPhone e iPad: la parte che, se sbagliata, fa perdere
// dati senza che nessuno se ne accorga. Questi test simulano due dispositivi
// veri che scrivono sullo stesso account.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { avviaApp, chiama, registra, ricreaSchema, type Sessione } from './aiuto.js';
import { pool } from '../../src/db/pool.js';

let app: FastifyInstance;
let utente: Sessione;

const IPHONE = 'iphone-di-prova-001';
const IPAD = 'ipad-di-prova-002';

beforeAll(async () => {
  await ricreaSchema();
  app = await avviaApp();
  utente = await registra(app, { device: IPHONE });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

/** Crea un'attività dall'iPhone e restituisce la riga creata. */
async function creaAttivita(titolo: string, giorno = '2026-09-09') {
  const risposta = await chiama(
    app, utente, 'POST', '/tasks',
    { title: titolo, date: giorno, category: 'PERSONALE' },
    IPHONE,
  );
  expect(risposta.statusCode).toBe(201);
  return risposta.json();
}

function push(changes: unknown[], device: string) {
  return chiama(app, utente, 'POST', '/sync/push', { changes }, device);
}

describe('lettura delle modifiche', () => {
  it('un dispositivo nuovo scarica tutto partendo da zero', async () => {
    await creaAttivita('Prima cosa');

    const risposta = await chiama(app, utente, 'GET', '/sync/changes?since=0&limit=200', undefined, IPAD);

    expect(risposta.statusCode).toBe(200);
    const corpo = risposta.json();
    expect(corpo.changes.length).toBeGreaterThan(0);
    expect(corpo.cursor).toBeGreaterThan(0);
  });

  it('con il cursore aggiornato non riceve niente di nuovo', async () => {
    const primo = await chiama(app, utente, 'GET', '/sync/changes?since=0&limit=500', undefined, IPAD);
    const cursore = primo.json().cursor;

    const secondo = await chiama(
      app, utente, 'GET', `/sync/changes?since=${cursore}&limit=500`, undefined, IPAD,
    );

    expect(secondo.json().changes).toHaveLength(0);
    expect(secondo.json().cursor).toBe(cursore);
  });

  it('il cursore avanza quando qualcosa cambia', async () => {
    const prima = (await chiama(app, utente, 'GET', '/sync/cursor', undefined, IPAD)).json().cursor;
    await creaAttivita('Cosa nuova');
    const dopo = (await chiama(app, utente, 'GET', '/sync/cursor', undefined, IPAD)).json().cursor;

    expect(dopo).toBeGreaterThan(prima);
  });
});

describe('scrittura dall\'altro dispositivo', () => {
  it('un aggiornamento parziale non cancella gli altri campi', async () => {
    const attivita = await creaAttivita('Palestra');

    const risposta = await push([{
      entity: 'tasks',
      id: attivita.id,
      clientUpdatedAt: '2030-01-01T10:00:00.000Z',
      data: { title: 'Palestra (dall iPad)' },
    }], IPAD);

    const esito = risposta.json().results[0];
    expect(esito.outcome).toBe('applied');
    expect(esito.server.title).toBe('Palestra (dall iPad)');
    // Il campo che non è stato inviato deve essere ancora lì.
    expect(esito.server.date).toBe('2026-09-09');
    expect(esito.server.category).toBe('PERSONALE');
  });

  it('un elemento creato offline arriva per la prima volta e viene inserito', async () => {
    const id = randomUUID();

    const risposta = await push([{
      entity: 'tasks',
      id,
      clientUpdatedAt: '2026-09-09T08:00:00.000Z',
      data: { title: 'Creata offline', date: '2026-09-10', category: 'CASA' },
    }], IPAD);

    expect(risposta.json().results[0].outcome).toBe('applied');
    expect(risposta.json().results[0].server.title).toBe('Creata offline');
  });
});

describe('conflitti', () => {
  it('vince la modifica avvenuta più tardi sul dispositivo', async () => {
    const attivita = await creaAttivita('Contesa');

    // L'iPad scrive con un istante nel futuro.
    await push([{
      entity: 'tasks',
      id: attivita.id,
      clientUpdatedAt: '2030-01-01T10:00:00.000Z',
      data: { title: 'Versione iPad' },
    }], IPAD);

    // L'iPhone arriva dopo, ma con una modifica più vecchia.
    const risposta = await push([{
      entity: 'tasks',
      id: attivita.id,
      clientUpdatedAt: '2020-01-01T10:00:00.000Z',
      data: { title: 'Versione vecchia iPhone' },
    }], IPHONE);

    const esito = risposta.json().results[0];
    expect(esito.outcome).toBe('rejected');
    // E soprattutto: il server restituisce lo stato autorevole, così il
    // dispositivo si riallinea invece di ritentare all'infinito.
    expect(esito.server.title).toBe('Versione iPad');
  });

  it('una modifica più recente sovrascrive, come deve', async () => {
    const attivita = await creaAttivita('Ordine giusto');

    await push([{
      entity: 'tasks',
      id: attivita.id,
      clientUpdatedAt: '2026-01-01T10:00:00.000Z',
      data: { title: 'Prima' },
    }], IPHONE);

    const risposta = await push([{
      entity: 'tasks',
      id: attivita.id,
      clientUpdatedAt: '2027-01-01T10:00:00.000Z',
      data: { title: 'Dopo' },
    }], IPAD);

    expect(risposta.json().results[0].outcome).toBe('applied');
    expect(risposta.json().results[0].server.title).toBe('Dopo');
  });

  it('la cancellazione vince sulle modifiche successive', async () => {
    const attivita = await creaAttivita('Da cancellare');

    await push([{
      entity: 'tasks',
      id: attivita.id,
      clientUpdatedAt: '2030-02-01T08:00:00.000Z',
      data: { deletedAt: '2030-02-01T08:00:00.000Z' },
    }], IPAD);

    const risposta = await push([{
      entity: 'tasks',
      id: attivita.id,
      clientUpdatedAt: '2031-01-01T08:00:00.000Z',
      data: { title: 'Provo a resuscitarla' },
    }], IPHONE);

    const esito = risposta.json().results[0];
    expect(esito.outcome).toBe('rejected');
    expect(esito.server.deletedAt).not.toBeNull();
  });

  it('la cancellazione viaggia verso l\'altro dispositivo', async () => {
    const attivita = await creaAttivita('Sparirà');
    const cursore = (await chiama(app, utente, 'GET', '/sync/cursor', undefined, IPAD)).json().cursor;

    await chiama(app, utente, 'DELETE', `/tasks/${attivita.id}`, undefined, IPHONE);

    const risposta = await chiama(
      app, utente, 'GET', `/sync/changes?since=${cursore}&limit=200`, undefined, IPAD,
    );

    const cancellata = risposta.json().changes.find(
      (modifica: { data: { id: string } }) => modifica.data.id === attivita.id,
    );

    // Se si usasse un DELETE vero invece della cancellazione logica, l'iPad
    // non riceverebbe niente e continuerebbe a mostrare l'attività per sempre.
    expect(cancellata).toBeDefined();
    expect(cancellata.data.deletedAt).not.toBeNull();
  });
});

describe('isolamento fra utenti', () => {
  it('non si può modificare un elemento di un\'altra persona', async () => {
    const altra = await registra(app, { device: 'dispositivo-altrui' });
    const attivita = await creaAttivita('Roba mia');

    const risposta = await chiama(app, altra, 'POST', '/sync/push', {
      changes: [{
        entity: 'tasks',
        id: attivita.id,
        clientUpdatedAt: '2030-01-01T10:00:00.000Z',
        data: { title: 'Modificata da un estraneo' },
      }],
    }, 'dispositivo-altrui');

    // Il push non fallisce con un errore: viene semplicemente rifiutato, e
    // l'estraneo non riceve nemmeno il contenuto della riga.
    const esito = risposta.json().results[0];
    expect(esito.outcome).toBe('rejected');
    expect(esito.server).toBeNull();

    // E l'originale è intatto.
    const originale = await chiama(app, utente, 'GET', `/tasks/${attivita.id}`, undefined, IPHONE);
    expect(originale.json().title).toBe('Roba mia');
  });

  it('le modifiche di un utente non compaiono nel flusso di un altro', async () => {
    const altra = await registra(app, { device: 'altro-dispositivo' });
    await creaAttivita('Solo mia');

    const risposta = await chiama(
      app, altra, 'GET', '/sync/changes?since=0&limit=200', undefined, 'altro-dispositivo',
    );

    const titoli = risposta.json().changes.map(
      (modifica: { data: { title?: string } }) => modifica.data.title,
    );
    expect(titoli).not.toContain('Solo mia');
  });
});

describe('attività ricorrenti', () => {
  it('creare una ripetizione genera le occorrenze future', async () => {
    const risposta = await chiama(app, utente, 'POST', '/tasks', {
      title: 'Palestra ricorrente',
      date: '2026-10-05',
      category: 'SPORT',
      repeatType: 'CUSTOM',
      repeatDays: [1, 3, 5],
    }, IPHONE);

    expect(risposta.statusCode).toBe(201);

    const elenco = await chiama(
      app, utente, 'GET', '/tasks?from=2026-10-05&to=2026-11-05', undefined, IPHONE,
    );

    const ricorrenti = elenco.json().items.filter(
      (voce: { title: string }) => voce.title === 'Palestra ricorrente',
    );

    // Circa tre a settimana per un mese.
    expect(ricorrenti.length).toBeGreaterThan(8);

    // Tutte cadono nei giorni scelti (1 = lunedì … 7 = domenica).
    for (const voce of ricorrenti) {
      const giorno = new Date(`${voce.date}T12:00:00Z`).getUTCDay();
      const iso = giorno === 0 ? 7 : giorno;
      expect([1, 3, 5]).toContain(iso);
    }
  });
});
