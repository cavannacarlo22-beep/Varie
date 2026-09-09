// FILE: backend/src/services/jwt.ts
//
// Firma e verifica dell'access token.
//
// L'access token è un JWT firmato HS256 con vita breve (15 minuti). Contiene
// solo ciò che serve a ogni richiesta: chi sei, che ruolo hai, come ti chiami.
// Non contiene email né dati personali, perché un JWT è leggibile da chiunque
// lo intercetti: è firmato, non cifrato.
//
// Il ruolo è dentro il token per evitare una query al database a ogni
// richiesta, ma le rotte amministrative rileggono comunque l'utente: un ruolo
// revocato deve avere effetto entro la vita dell'access token, non dopo.

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
import type { AccessTokenPayload, UserRole } from '../types/domain.js';

const ISSUER = 'nina';
const AUDIENCE = 'nina-app';

export function signAccessToken(userId: string, role: UserRole, displayName: string): string {
  const payload: AccessTokenPayload = { sub: userId, role, dn: displayName };

  return jwt.sign(payload, config.auth.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.auth.accessTokenTtl,
    issuer: ISSUER,
    audience: AUDIENCE,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret, {
      // L'algoritmo va imposto: accettare "alg" dal token è una vulnerabilità
      // classica dei JWT.
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw AppError.unauthenticated('Sessione non valida.');
    }

    return {
      sub: decoded.sub,
      role: (decoded as jwt.JwtPayload & { role?: UserRole }).role ?? 'USER',
      dn: (decoded as jwt.JwtPayload & { dn?: string }).dn ?? '',
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'La sessione è scaduta. Riprova.');
    }
    if (error instanceof AppError) throw error;
    throw AppError.unauthenticated('Sessione non valida.');
  }
}
