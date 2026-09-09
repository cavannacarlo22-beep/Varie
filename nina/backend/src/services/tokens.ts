// FILE: backend/src/services/tokens.ts
//
// Token opachi: refresh token, verifica email, reset password.
//
// Perché SHA-256 e non Argon2 come per le password?
// Argon2 è lento *di proposito*, perché una password è scelta da un essere
// umano e ha poca entropia: bisogna rendere costoso provarne miliardi. Questi
// token invece sono 32 byte casuali generati da noi: provarli a forza bruta è
// già impossibile. Rallentare l'hash non aggiungerebbe sicurezza, aggiungerebbe
// solo latenza a ogni refresh. SHA-256 è la scelta corretta qui.
//
// Quello che conta è che nel database finisce solo l'hash: chi ottenesse un
// dump non potrebbe ricostruire nessun token valido.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/** 32 byte casuali, in base64url: 256 bit di entropia, sicuro in una URL. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Per i token monouso di verifica email e reset password. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Per i refresh token si usa un HMAC con JWT_REFRESH_SECRET invece di un hash
 * semplice. Il motivo è pratico: cambiare quel segreto invalida in un colpo
 * solo tutte le sessioni esistenti — utile in caso di incidente — senza dover
 * svuotare una tabella. In più, chi ottenesse solo il database non potrebbe
 * verificare un token indovinato senza avere anche il segreto.
 */
export function hashRefreshToken(token: string): string {
  return createHmac('sha256', config.auth.jwtRefreshSecret).update(token).digest('hex');
}

/**
 * Confronto a tempo costante fra due hash esadecimali.
 *
 * Serve quando confrontiamo in memoria; le ricerche nel database avvengono per
 * indice sull'hash, quindi non c'è nulla da proteggere lì.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function expiresInDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function expiresInHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function expiresInMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
