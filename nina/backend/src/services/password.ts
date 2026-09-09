// FILE: backend/src/services/password.ts
//
// Hashing delle password con Argon2id.
//
// Argon2id è il vincitore della Password Hashing Competition e la scelta
// consigliata da OWASP: è pensato per essere lento in modo *configurabile* e
// per consumare memoria, il che rende gli attacchi con GPU e ASIC molto meno
// convenienti rispetto a bcrypt.
//
// La password in chiaro non esce mai da questo modulo e non viene mai loggata.

import argon2 from 'argon2';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

const argonOptions: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: config.auth.argon.memoryCost,
  timeCost: config.auth.argon.timeCost,
  parallelism: config.auth.argon.parallelism,
};

/** Requisiti minimi. Volutamente semplici: lunghezza prima di tutto. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Controlla che la password sia accettabile e spiega cosa manca.
 *
 * La regola principale è la lunghezza: una passphrase lunga batte una password
 * corta piena di simboli, ed è anche molto più facile da ricordare. Chiediamo
 * comunque una minima varietà per scoraggiare "aaaaaaaaaa".
 */
export function validatePasswordStrength(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw AppError.validation(
      `La password deve avere almeno ${PASSWORD_MIN_LENGTH} caratteri. ` +
        `Una frase che ricordi facilmente va benissimo.`,
    );
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw AppError.validation(`La password non può superare ${PASSWORD_MAX_LENGTH} caratteri.`);
  }

  const distinctCharacters = new Set(password).size;
  if (distinctCharacters < 5) {
    throw AppError.validation(
      'Questa password è troppo ripetitiva. Prova con qualcosa di più vario.',
    );
  }

  const tooCommon = [
    'password',
    'passw0rd',
    '1234567890',
    'qwertyuiop',
    'iloveyou',
    'letmein',
    'benvenuto',
    'ciaociao',
  ];
  const lowered = password.toLowerCase();
  if (tooCommon.some((candidate) => lowered.includes(candidate))) {
    throw AppError.validation(
      'Questa password è tra le più usate al mondo, quindi tra le prime che verrebbero provate. Sceglierne un\'altra?',
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argonOptions);
}

/**
 * Verifica una password.
 *
 * Restituisce anche `needsRehash`: se in futuro alziamo i parametri di Argon2,
 * gli hash vecchi vengono aggiornati silenziosamente al primo login riuscito,
 * senza chiedere niente all'utente.
 */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  let valid = false;
  try {
    valid = await argon2.verify(hash, password);
  } catch {
    // Un hash corrotto o in un formato sconosciuto non è un errore da propagare:
    // per chi tenta l'accesso è semplicemente una password sbagliata.
    return { valid: false, needsRehash: false };
  }

  if (!valid) return { valid: false, needsRehash: false };

  let needsRehash = false;
  try {
    needsRehash = argon2.needsRehash(hash, argonOptions);
  } catch {
    needsRehash = false;
  }

  return { valid: true, needsRehash };
}
