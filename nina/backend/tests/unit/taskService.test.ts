// FILE: backend/tests/unit/taskService.test.ts
//
// Le date delle ripetizioni. È il calcolo più facile da sbagliare di tutto il
// progetto: un errore qui produce attività che compaiono nel giorno sbagliato,
// e ci si accorge solo settimane dopo.

import { describe, expect, it } from 'vitest';
import { occurrenceDates } from '../../src/services/taskService.js';

describe('occorrenze quotidiane', () => {
  it('genera un giorno dopo l\'altro, escludendo quello di partenza', () => {
    const date = occurrenceDates('2026-09-09', 'DAILY', [], null, '2026-09-09', 5);
    expect(date).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
    ]);
  });

  it('si ferma alla data di fine', () => {
    const date = occurrenceDates('2026-09-09', 'DAILY', [], '2026-09-12', '2026-09-09');
    expect(date).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
  });
});

describe('occorrenze settimanali', () => {
  it('ripete nello stesso giorno della settimana', () => {
    // Il 9 settembre 2026 è un mercoledì.
    const date = occurrenceDates('2026-09-09', 'WEEKLY', [], null, '2026-09-09', 3);
    expect(date).toEqual(['2026-09-16', '2026-09-23', '2026-09-30']);
  });
});

describe('occorrenze personalizzate', () => {
  it('cade solo nei giorni scelti', () => {
    // 1 = lunedì, 3 = mercoledì, 5 = venerdì.
    const date = occurrenceDates('2026-09-09', 'CUSTOM', [1, 3, 5], null, '2026-09-09', 6);

    expect(date).toEqual([
      '2026-09-11', // venerdì
      '2026-09-14', // lunedì
      '2026-09-16', // mercoledì
      '2026-09-18', // venerdì
      '2026-09-21', // lunedì
      '2026-09-23', // mercoledì
    ]);
  });

  it('senza giorni scelti ricade sul giorno di partenza', () => {
    const date = occurrenceDates('2026-09-09', 'CUSTOM', [], null, '2026-09-09', 2);
    expect(date).toEqual(['2026-09-16', '2026-09-23']);
  });
});

describe('occorrenze mensili', () => {
  it('mantiene il giorno del mese', () => {
    const date = occurrenceDates('2026-01-15', 'MONTHLY', [], null, '2026-01-15', 3);
    expect(date).toEqual(['2026-02-15', '2026-03-15', '2026-04-15']);
  });

  it('il 31 gennaio più un mese è l\'ultimo giorno di febbraio, non il 3 marzo', () => {
    const date = occurrenceDates('2026-01-31', 'MONTHLY', [], null, '2026-01-31', 2);
    expect(date[0]).toBe('2026-02-28');
    // E il mese dopo torna al 31: lo scivolamento non è permanente.
    expect(date[1]).toBe('2026-03-31');
  });
});

describe('casi limite', () => {
  it('una ripetizione "mai" non genera niente', () => {
    expect(occurrenceDates('2026-09-09', 'NEVER', [], null, '2026-09-09')).toEqual([]);
  });

  it('non guarda oltre l\'orizzonte di 90 giorni', () => {
    const date = occurrenceDates('2026-01-01', 'DAILY', [], null, '2026-01-01', 500);
    expect(date.length).toBeLessThanOrEqual(90);
    expect(date[date.length - 1]! <= '2026-04-01').toBe(true);
  });

  it('una data di fine già passata non genera niente', () => {
    const date = occurrenceDates('2026-09-09', 'DAILY', [], '2026-09-01', '2026-09-09');
    expect(date).toEqual([]);
  });
});
