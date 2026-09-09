// FILE: backend/tests/unit/ninaBrain.test.ts

import { describe, expect, it } from 'vitest';
import { detectTopic, respond, TOPICS, topicCount } from '../../src/services/ninaBrain.js';

const contesto = { userName: 'Marti', hour: 15, repeatCount: 0 };

describe('riconoscimento degli argomenti', () => {
  it.each([
    ['sono stanchissima oggi', 'stanchezza'],
    ['sono stanca', 'stanchezza'],
    ['ho una stanchezza addosso', 'stanchezza'],
    ['ho un ansia pazzesca', 'ansia'],
    ['sono ansiosa per domani', 'ansia'],
    ['oggi mi sento tristissima', 'tristezza'],
    ['sono felicissima!!', 'felicita'],
    ['ho l esame di anatomia domani', 'esami'],
    ['il mio capo mi ha trattata male', 'lavoro'],
    ['domani ho un colloquio', 'colloquio'],
    ['mi sono lasciata con il mio ragazzo', 'rottura'],
    ['non riesco a dormire da giorni', 'sonno'],
    ['ho il ciclo e sto morendo', 'ciclo'],
    ['rimando sempre tutto', 'procrastinazione'],
    ['non so cosa fare della mia vita', 'futuro'],
    ['sei una persona vera?', 'chi_sei'],
    ['grazie', 'grazie'],
  ])('«%s» → tema %s', (messaggio, atteso) => {
    expect(detectTopic(messaggio)?.id).toBe(atteso);
  });

  it('un evento raccontato batte il tema generico in cui rientra', () => {
    // Contiene due espressioni del tema "amicizia" e una sola di "litigio",
    // ma di cui si sta parlando è il litigio.
    expect(detectTopic('ho litigato con la mia migliore amica')?.id).toBe('litigio');
    // Senza il verbo, invece, è davvero una riflessione sull'amicizia.
    expect(detectTopic('la mia amica non mi cerca più')?.id).toBe('amicizia');
  });

  it('non inventa un tema quando non ce n\'è uno', () => {
    expect(detectTopic('mmm ok va bene')).toBeUndefined();
  });
});

describe('risposte', () => {
  it('risponde sempre qualcosa, anche a un messaggio senza tema', () => {
    const risposta = respond('boh vediamo come va a finire', contesto);
    expect(risposta.text.length).toBeGreaterThan(3);
  });

  it('a un messaggio brevissimo risponde in modo brevissimo', () => {
    const risposta = respond('ok', contesto);
    expect(risposta.topicId).toBe('breve');
    expect(risposta.text.length).toBeLessThan(30);
  });

  it('al secondo messaggio sullo stesso tema approfondisce invece di ripartire', () => {
    const prima = respond('sono stanca', { ...contesto, repeatCount: 0 });
    const dopo = respond('sono stanca da settimane', { ...contesto, repeatCount: 1 });

    const tema = TOPICS.find((t) => t.id === 'stanchezza');
    expect(tema?.replies).toContain(prima.text);
    expect(tema?.followUps).toContain(dopo.text);
  });

  it('il saluto cambia con l\'ora', () => {
    // Non si controlla una parola precisa: ogni fascia ha più varianti, e
    // fissarne una nel test bloccherebbe la scrittura di nuove risposte.
    // Quello che deve valere è che le fasce siano davvero diverse fra loro.
    const saluti = [8, 12, 17, 21, 2].map(
      (hour) => respond('ciao', { ...contesto, hour }).text,
    );

    expect(new Set(saluti).size).toBe(saluti.length);
    // A notte fonda Nina non dice "buongiorno".
    expect(saluti[4]!.toLowerCase()).not.toContain('buongiorno');
  });

  it('usa il nome della persona nei saluti del mattino', () => {
    const testo = respond('ciao', { userName: 'Giulia', hour: 9, repeatCount: 0 }).text;
    expect(testo).toContain('Giulia');
  });

  it('la stessa frase riceve la stessa risposta (non è casuale a ogni tentativo)', () => {
    const uno = respond('sono stanchissima', contesto).text;
    const due = respond('sono stanchissima', contesto).text;
    expect(uno).toBe(due);
  });
});

describe('copertura', () => {
  it('ogni tema ha almeno una risposta, e nessuna è vuota', () => {
    for (const tema of TOPICS) {
      if (tema.id === 'saluto') continue; // generato in base all'ora
      expect(tema.replies.length, `il tema ${tema.id} non ha risposte`).toBeGreaterThan(0);
      for (const risposta of [...tema.replies, ...(tema.followUps ?? [])]) {
        expect(risposta.trim().length).toBeGreaterThan(3);
      }
    }
  });

  it('conosce un numero utile di argomenti', () => {
    expect(topicCount()).toBeGreaterThanOrEqual(30);
  });

  it('nessun tema ha un id duplicato', () => {
    const identificativi = TOPICS.map((t) => t.id);
    expect(new Set(identificativi).size).toBe(identificativi.length);
  });
});
