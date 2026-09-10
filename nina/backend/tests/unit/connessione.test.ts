// FILE: backend/tests/unit/connessione.test.ts
//
// La decisione su TLS.
//
// È una funzione di sei righe e ha un test suo perché è l'unico punto del
// backend in cui si decide se la connessione al database è cifrata e se il
// certificato viene verificato. Quando qualcuno, fra un anno, incontrerà un
// errore di certificato in produzione, la tentazione sarà mettere
// `rejectUnauthorized: false` e andare avanti: è la riga che trasforma una
// connessione cifrata in una connessione cifrata *verso chiunque*. Questi
// test la rendono un fallimento rumoroso invece di una scorciatoia silenziosa.

import { describe, expect, it } from 'vitest';
import { connessione } from '../../src/db/pool.js';

describe('scelta di TLS', () => {
  it('verso Neon cifra e verifica il certificato', () => {
    const { ssl } = connessione(
      'postgresql://utente:segreto@ep-cosa-123-pooler.eu-central-1.aws.neon.tech/nina?sslmode=require',
    );
    expect(ssl).toEqual({ rejectUnauthorized: true });
  });

  it('verso un host qualsiasi cifra e verifica, anche senza sslmode', () => {
    const { ssl } = connessione('postgresql://utente:segreto@db.example.com/nina');
    expect(ssl).toEqual({ rejectUnauthorized: true });
  });

  it('non disattiva mai la verifica del certificato fuori da localhost', () => {
    // Nemmeno se qualcuno la chiede esplicitamente nella stringa: quella
    // decisione non deve poter arrivare da una variabile d'ambiente copiata
    // da un forum.
    for (const url of [
      'postgresql://u:p@db.example.com/nina?sslmode=no-verify',
      'postgresql://u:p@db.example.com/nina?ssl=false',
      'postgresql://u:p@db.example.com/nina?sslmode=disable',
    ]) {
      expect(connessione(url).ssl, url).toEqual({ rejectUnauthorized: true });
    }
  });

  it('in locale non usa TLS: un PostgreSQL di sviluppo non ce l\'ha', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(connessione(`postgresql://nina:nina@${host}:5432/nina_dev`).ssl, host).toBe(false);
    }
  });

  it('in locale ignora sslmode invece di fallire', () => {
    // Il caso vero: si copia la stringa di Neon, si cambia l'host per provare
    // in locale e ci si dimentica di togliere ?sslmode=require. Prima di
    // questa funzione il risultato era «self-signed certificate» e mezz'ora
    // persa a capire perché.
    const { ssl, stringa } = connessione(
      'postgresql://nina:nina@127.0.0.1:5432/nina_dev?sslmode=require',
    );
    expect(ssl).toBe(false);
    expect(stringa).not.toContain('sslmode');
  });
});

describe('pulizia della stringa', () => {
  it('toglie i parametri che deciderebbero TLS al posto nostro', () => {
    const { stringa } = connessione(
      'postgresql://u:p@db.example.com/nina?sslmode=require&ssl=true&uselibpqcompat=true',
    );
    expect(stringa).not.toContain('sslmode');
    expect(stringa).not.toContain('uselibpqcompat');
  });

  it('conserva gli altri parametri', () => {
    // Neon ne usa alcuni suoi: toglierli romperebbe il collegamento.
    const { stringa } = connessione(
      'postgresql://u:p@ep-x.neon.tech/nina?sslmode=require&channel_binding=require&application_name=nina',
    );
    expect(stringa).toContain('channel_binding=require');
    expect(stringa).toContain('application_name=nina');
  });

  it('conserva host, porta, database e credenziali', () => {
    const { stringa } = connessione('postgresql://tizio:caio@db.example.com:6543/nina?sslmode=require');
    expect(stringa).toContain('tizio:caio@db.example.com:6543');
    expect(stringa).toContain('/nina');
  });

  it('una stringa illeggibile non fa cadere il processo', () => {
    // Meglio lasciar parlare l'errore di `pg`, che è più preciso del nostro.
    const esito = connessione('non è un indirizzo');
    expect(esito.stringa).toBe('non è un indirizzo');
    expect(esito.ssl).toEqual({ rejectUnauthorized: true });
  });
});
