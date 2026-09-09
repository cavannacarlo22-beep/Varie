// FILE: backend/tests/integration/privacy.test.ts
//
// Le promesse fatte all'utente, verificate.
//
// "Il diario non lo legge nessuno" e "un utente vede solo i propri dati" sono
// affermazioni che compaiono nell'interfaccia. Un test che le controlla è
// l'unica cosa che impedisce a un endpoint aggiunto fra sei mesi di renderle
// false senza che nessuno se ne accorga.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { avviaApp, chiama, registra, ricreaSchema, type Sessione } from './aiuto.js';
import { pool } from '../../src/db/pool.js';

let app: FastifyInstance;
let anna: Sessione;
let bea: Sessione;

beforeAll(async () => {
  await ricreaSchema();
  app = await avviaApp();
  anna = await registra(app);
  bea = await registra(app);
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('isolamento dei dati', () => {
  it('Bea non vede il diario di Anna', async () => {
    await chiama(app, anna, 'POST', '/diary', {
      content: 'Una cosa molto privata che ho scritto oggi.',
    });

    const suo = await chiama(app, bea, 'GET', '/diary');
    expect(suo.json().items).toHaveLength(0);
  });

  it('Bea non può aprire una pagina di diario di Anna nemmeno con l\'id giusto', async () => {
    const creata = await chiama(app, anna, 'POST', '/diary', {
      content: 'Un altro pensiero privato.',
    });
    const id = creata.json().id;

    const tentativo = await chiama(app, bea, 'GET', `/diary/${id}`);
    expect(tentativo.statusCode).toBe(404);
  });

  it('Bea non può modificare un\'attività di Anna', async () => {
    const creata = await chiama(app, anna, 'POST', '/tasks', {
      title: 'Cosa di Anna',
      date: '2026-09-09',
    });

    const tentativo = await chiama(app, bea, 'PUT', `/tasks/${creata.json().id}`, {
      title: 'Modificata da Bea',
    });

    expect(tentativo.statusCode).toBe(404);
  });

  it('la ricerca nel diario non attraversa gli account', async () => {
    await chiama(app, anna, 'POST', '/diary', {
      content: 'parolachiaveunica trovami se ci riesci',
    });

    const risultati = await chiama(app, bea, 'GET', '/diary/search?q=parolachiaveunica');
    expect(risultati.json().items).toHaveLength(0);
  });
});

describe('il pannello amministratore', () => {
  it('non esiste per chi non è amministratrice', async () => {
    // 404 e non 403: chi non ha i permessi non deve nemmeno sapere che c'è.
    for (const percorso of ['/admin/users', '/admin/stats', '/admin/quotes', '/admin/audit']) {
      const risposta = await chiama(app, anna, 'GET', percorso);
      expect(risposta.statusCode, percorso).toBe(404);
    }
  });

  it('nessuna rotta amministrativa restituisce il contenuto dei diari', async () => {
    // Controllo statico: si legge il codice delle rotte admin e si verifica
    // che non selezioni mai le colonne di contenuto privato. È più solido di
    // provare gli endpoint uno a uno, perché copre anche quelli aggiunti in
    // futuro.
    const cartella = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'routes');
    const sorgente = await readFile(join(cartella, 'admin.ts'), 'utf8');

    expect(sorgente).not.toMatch(/diary_entries[^)]*content/s);
    expect(sorgente).not.toMatch(/friend_messages[^)]*content/s);
    expect(sorgente).not.toMatch(/SELECT[^;]*\bcontent\b/s);
  });

  it('nessuna rotta costruisce SQL concatenando stringhe', async () => {
    // L'helper `sql` rende impossibile l'interpolazione, ma solo finché lo si
    // usa: questo test controlla che nessuno abbia aggirato il meccanismo con
    // un template literal normale dentro una query.
    const cartella = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

    async function fileTs(percorso: string): Promise<string[]> {
      const voci = await readdir(percorso, { withFileTypes: true });
      const risultato: string[] = [];
      for (const voce of voci) {
        const completo = join(percorso, voce.name);
        if (voce.isDirectory()) risultato.push(...(await fileTs(completo)));
        else if (voce.name.endsWith('.ts')) risultato.push(completo);
      }
      return risultato;
    }

    for (const file of await fileTs(cartella)) {
      const contenuto = await readFile(file, 'utf8');
      // Una query passata a pool.query con un template literal interpolato
      // sarebbe l'unico modo di reintrodurre la SQL injection.
      expect(contenuto, file).not.toMatch(/\.query\(\s*`[^`]*\$\{/);
    }
  });
});

describe('cancellazione dell\'account', () => {
  it('elimina davvero i dati, non li nasconde', async () => {
    const utente = await registra(app);

    await chiama(app, utente, 'POST', '/tasks', { title: 'Sparirà', date: '2026-09-09' });
    await chiama(app, utente, 'POST', '/diary', { content: 'Anche questo sparirà.' });

    const prima = await pool.query('SELECT count(*)::int AS n FROM tasks WHERE user_id = $1', [
      utente.userId,
    ]);
    expect(prima.rows[0].n).toBeGreaterThan(0);

    const eliminazione = await chiama(app, utente, 'DELETE', '/me', {
      password: 'una frase lunga che ricordo',
      confirm: 'ELIMINA IL MIO ACCOUNT',
    });
    expect(eliminazione.statusCode).toBe(200);

    // Le righe non ci sono più: è una DELETE, non un flag.
    for (const tabella of ['tasks', 'diary_entries', 'moods', 'refresh_tokens']) {
      const dopo = await pool.query(
        `SELECT count(*)::int AS n FROM ${tabella} WHERE user_id = $1`,
        [utente.userId],
      );
      expect(dopo.rows[0].n, tabella).toBe(0);
    }

    const utenteRimasto = await pool.query('SELECT count(*)::int AS n FROM users WHERE id = $1', [
      utente.userId,
    ]);
    expect(utenteRimasto.rows[0].n).toBe(0);
  });

  it('serve la password giusta per eliminare', async () => {
    const utente = await registra(app);

    const risposta = await chiama(app, utente, 'DELETE', '/me', {
      password: 'password sbagliata davvero',
      confirm: 'ELIMINA IL MIO ACCOUNT',
    });

    expect(risposta.statusCode).toBe(400);
  });
});
