import { describe, expect, it } from 'vitest';
import { calc, formatNumber } from '../src/lib/formula';

describe('calcolatrice', () => {
  it('quattro operazioni e precedenza', () => {
    expect(calc('2+3*4')).toBe(14);
    expect(calc('(2+3)*4')).toBe(20);
    expect(calc('10/4')).toBe(2.5);
    expect(calc('7-10')).toBe(-3);
  });
  it('simboli × ÷ − e decimali con virgola', () => {
    expect(calc('3,5 × 2')).toBe(7);
    expect(calc('9 ÷ 3 − 1')).toBe(2);
  });
  it('niente errori di virgola mobile', () => {
    expect(calc('0.1+0.2')).toBe(0.3);
  });
  it('percentuali come la calcolatrice', () => {
    expect(calc('200+10%')).toBe(220);
    expect(calc('200-25%')).toBe(150);
    expect(calc('80*25%')).toBe(20);
    expect(calc('50%')).toBe(0.5);
  });
  it('potenze, radici, fattoriale', () => {
    expect(calc('2^10')).toBe(1024);
    expect(calc('-2^2')).toBe(-4);
    expect(calc('2^3^2')).toBe(512);
    expect(calc('√144')).toBe(12);
    expect(calc('√(16)+1')).toBe(5);
    expect(calc('RADICE(27; 3)')).toBe(3);
    expect(calc('5!')).toBe(120);
  });
  it('moltiplicazione implicita e costanti', () => {
    expect(calc('2(3+4)')).toBe(14);
    expect(calc('2π')).toBeCloseTo(6.283185307, 6);
  });
  it('funzioni italiane', () => {
    expect(calc('SOMMA(1;2;3)')).toBe(6);
    expect(calc('MEDIA(2;4;9)')).toBe(5);
    expect(calc('ARROTONDA(3,14159; 2)')).toBe(3.14);
    expect(calc('PERCENTUALE(30; 120)')).toBe(25);
    expect(calc('SE(5>3; "si"; "no")')).toBe('si');
  });
  it('errori gestiti', () => {
    expect(() => calc('1/0')).toThrow('Divisione per zero');
    expect(() => calc('2+')).toThrow();
    expect(() => calc('FOO(1)')).toThrow('Funzione sconosciuta');
    expect(() => calc('A1+1')).toThrow();
  });
  it('formato italiano', () => {
    expect(formatNumber(12345.5)).toBe('12.345,5');
  });
});
