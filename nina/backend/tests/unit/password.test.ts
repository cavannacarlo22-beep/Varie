// FILE: backend/tests/unit/password.test.ts

import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
  PASSWORD_MIN_LENGTH,
} from '../../src/services/password.js';

describe('requisiti della password', () => {
  it('accetta una frase lunga e comune da ricordare', () => {
    expect(() => validatePasswordStrength('la mia gatta si chiama luna')).not.toThrow();
  });

  it('rifiuta una password troppo corta', () => {
    expect(() => validatePasswordStrength('corta1')).toThrow(/almeno/);
  });

  it('rifiuta una password ripetitiva', () => {
    expect(() => validatePasswordStrength('aaaaaaaaaaaaaa')).toThrow(/ripetitiva/);
  });

  it('rifiuta le password più usate al mondo', () => {
    expect(() => validatePasswordStrength('password12345')).toThrow(/usate al mondo/);
    expect(() => validatePasswordStrength('qwertyuiop123')).toThrow(/usate al mondo/);
  });

  it('la lunghezza minima è quella dichiarata', () => {
    const appena = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
    expect(() => validatePasswordStrength(appena)).toThrow();
  });
});

describe('hashing', () => {
  it('produce un hash Argon2id e lo verifica', async () => {
    const hash = await hashPassword('una frase che ricordo bene');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('una frase');

    const esito = await verifyPassword(hash, 'una frase che ricordo bene');
    expect(esito.valid).toBe(true);
  });

  it('rifiuta la password sbagliata', async () => {
    const hash = await hashPassword('una frase che ricordo bene');
    const esito = await verifyPassword(hash, 'una frase diversa');
    expect(esito.valid).toBe(false);
  });

  it('due hash della stessa password sono diversi (sale casuale)', async () => {
    const uno = await hashPassword('la stessa identica password');
    const due = await hashPassword('la stessa identica password');
    expect(uno).not.toBe(due);
  });

  it('un hash corrotto non fa esplodere niente: è solo una password sbagliata', async () => {
    const esito = await verifyPassword('non-è-un-hash', 'qualsiasi cosa');
    expect(esito.valid).toBe(false);
  });
});
