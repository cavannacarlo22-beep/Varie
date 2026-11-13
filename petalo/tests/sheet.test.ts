import { describe, expect, it } from 'vitest';
import { colName, computeSheet, fromCSV, literal, remapCells, shiftFormula, toCSV } from '../src/lib/sheet';

describe('tabella', () => {
  it('nomi colonne', () => {
    expect(colName(0)).toBe('A');
    expect(colName(25)).toBe('Z');
    expect(colName(26)).toBe('AA');
  });
  it('valori letterali in formato italiano', () => {
    expect(literal('1.234,5')).toBe(1234.5);
    expect(literal('22%')).toBe(0.22);
    expect(literal('€ 10')).toBe(10);
    expect(literal('ciao')).toBe('ciao');
  });
  it('somme, medie, totali e riferimenti a catena', () => {
    const r = computeSheet({ A1: '10', A2: '20', A3: '30', A4: '=SOMMA(A1:A3)', B1: '=A4/3', B2: '=MEDIA(A1:A3)', B3: '=B1=B2', C1: '=A1*22%' });
    expect(r.A4.value).toBe(60);
    expect(r.B1.value).toBe(20);
    expect(r.B2.value).toBe(20);
    expect(r.B3.value).toBe(true);
    expect(r.C1.value).toBeCloseTo(2.2);
  });
  it('media ponderata voti × CFU', () => {
    const r = computeSheet({ B2: '30', C2: '12', B3: '24', C3: '6', D1: '=MEDIA.PONDERATA(B2:B3; C2:C3)' });
    expect(r.D1.value).toBe(28);
  });
  it('riconosce i riferimenti circolari', () => {
    const r = computeSheet({ A1: '=B1+1', B1: '=A1+1' });
    expect(r.A1.error).toBe('#CICLO!');
  });
  it('errori di cella si propagano', () => {
    const r = computeSheet({ A1: '=1/0', A2: '=A1+1' });
    expect(r.A1.error).toBe('#DIV/0!');
    expect(r.A2.error).toBe('#DIV/0!');
  });
  it('copia formule con riferimenti relativi e assoluti', () => {
    expect(shiftFormula('=A1+$B$1', 1, 1)).toBe('=B2+$B$1');
  });
  it('inserimento riga sposta le celle', () => {
    const out = remapCells({ A1: 'x', A2: 'y' }, (r, c) => ({ row: r >= 1 ? r + 1 : r, col: c }));
    expect(out).toEqual({ A1: 'x', A3: 'y' });
  });
  it('CSV andata e ritorno', () => {
    const cells = { A1: 'Nome', B1: 'Voto', A2: 'Analisi; I', B2: '28' };
    const csv = toCSV(cells, 2, 2, computeSheet(cells));
    expect(fromCSV(csv)).toEqual([['Nome', 'Voto'], ['Analisi; I', '28']]);
  });
});
