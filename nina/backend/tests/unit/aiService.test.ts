// FILE: backend/tests/unit/aiService.test.ts
//
// Il comportamento più importante di tutto il servizio: Nina risponde sempre,
// e sui segnali di crisi risponde con numeri veri senza passare da nessun
// modello.

import { describe, expect, it } from 'vitest';
import {
  generateFriendReply,
  friendEngineInfo,
  setProviderForTesting,
  type FriendTurn,
} from '../../src/services/aiService.js';

const contesto = { userName: 'Marti', hour: 20 };

function conversazione(...messaggi: string[]): FriendTurn[] {
  return messaggi.map((content, indice) => ({
    author: indice % 2 === 0 ? ('USER' as const) : ('NINA' as const),
    content,
  }));
}

describe('sicurezza', () => {
  it.each([
    'non ce la faccio più a vivere',
    'voglio farla finita',
    'penso di uccidermi',
    'mi taglio quando sto male',
  ])('«%s» riceve la risposta di sicurezza, non quella del modello', async (messaggio) => {
    const risposta = await generateFriendReply(conversazione(messaggio), contesto);

    expect(risposta.source).toBe('safety');
    // I numeri devono esserci davvero: è il punto della risposta.
    expect(risposta.text).toContain('02 2327 2327');
    expect(risposta.text).toContain('112');
  });

  it('una frase normale non fa scattare la risposta di sicurezza', async () => {
    const risposta = await generateFriendReply(
      conversazione('oggi sono stanca morta dopo la palestra'),
      contesto,
    );
    expect(risposta.source).not.toBe('safety');
  });
});

describe('funziona senza provider configurato', () => {
  it('senza chiave API risponde comunque, con il motore locale', async () => {
    setProviderForTesting(undefined);

    const risposta = await generateFriendReply(conversazione('sono stanchissima'), contesto);

    expect(risposta.source).toBe('fallback');
    expect(risposta.text.length).toBeGreaterThan(5);
  });

  it('dichiara quale motore sta usando', () => {
    const info = friendEngineInfo();
    expect(info.engine).toBe('locale');
    expect(info.topics).toBeGreaterThan(20);
  });
});

describe('quando il provider fallisce', () => {
  it('un errore del modello non lascia l\'utente senza risposta', async () => {
    setProviderForTesting({
      name: 'finto',
      async reply() {
        throw new Error('il provider è esploso');
      },
    });

    const risposta = await generateFriendReply(conversazione('ho l ansia'), contesto);

    expect(risposta.source).toBe('fallback');
    expect(risposta.text.length).toBeGreaterThan(5);

    setProviderForTesting(undefined);
  });

  it('quando il provider funziona, la sua risposta viene usata', async () => {
    setProviderForTesting({
      name: 'finto',
      async reply() {
        return 'Risposta del modello.';
      },
    });

    const risposta = await generateFriendReply(conversazione('ciao'), contesto);

    expect(risposta.source).toBe('ai');
    expect(risposta.text).toBe('Risposta del modello.');

    setProviderForTesting(undefined);
  });
});
