// FILE: backend/src/services/authService.ts
//
// Tutta la logica di autenticazione. Le rotte si limitano a validare l'input e
// a chiamare queste funzioni.

import { randomUUID } from 'node:crypto';
import { withTransaction } from '../db/pool.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import * as users from '../repositories/userRepository.js';
import * as tokens from '../repositories/tokenRepository.js';
import { hashPassword, validatePasswordStrength, verifyPassword } from './password.js';
import {
  expiresInDays,
  expiresInHours,
  expiresInMinutes,
  generateOpaqueToken,
  hashRefreshToken,
  hashToken,
} from './tokens.js';
import { signAccessToken } from './jwt.js';
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from './mailer.js';
import { toPublicUser, type PublicUser, type UserRow } from '../types/domain.js';

export interface SessionContext {
  deviceId: string | null;
  userAgent: string | null;
  deviceName?: string | null;
  platform?: string | null;
  appVersion?: string | null;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

/** Durata dell'access token in secondi, per l'app che pianifica il refresh. */
function accessTokenSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(config.auth.accessTokenTtl);
  if (!match) return 900;
  const amount = Number.parseInt(match[1] as string, 10);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const multipliers = { s: 1, m: 60, h: 3600, d: 86_400 } as const;
  return amount * multipliers[unit];
}

/** Crea una nuova sessione (famiglia di refresh token) per un utente. */
async function issueSession(
  user: UserRow,
  context: SessionContext,
  familyId: string,
  client?: Parameters<typeof tokens.insertRefreshToken>[1],
): Promise<AuthResult> {
  const refreshToken = generateOpaqueToken();

  await tokens.insertRefreshToken(
    {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      deviceId: context.deviceId,
      userAgent: context.userAgent,
      expiresAt: expiresInDays(config.auth.refreshTokenTtlDays),
    },
    client,
  );

  if (context.deviceId) {
    await tokens.registerDevice(
      {
        userId: user.id,
        deviceId: context.deviceId,
        name: context.deviceName ?? null,
        platform: context.platform ?? null,
        appVersion: context.appVersion ?? null,
      },
      client,
    );
  }

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user.id, user.role, user.display_name),
    refreshToken,
    accessTokenExpiresIn: accessTokenSeconds(),
  };
}

// ---------------------------------------------------------------------------
// Registrazione
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
}

export async function register(
  input: RegisterInput,
  context: SessionContext,
): Promise<AuthResult> {
  validatePasswordStrength(input.password);

  const email = users.normalizeEmail(input.email);
  const existing = await users.findUserByEmail(email);
  if (existing) {
    throw AppError.conflict('EMAIL_ALREADY_USED', 'Questa email è già registrata. Vuoi accedere?');
  }

  const passwordHash = await hashPassword(input.password);
  // Se non sceglie un nickname durante l'onboarding, il nome di battesimo è
  // il modo più naturale di chiamarla.
  const displayName = (input.displayName ?? input.firstName).trim();

  const { user, verificationToken } = await withTransaction(async (client) => {
    const created = await users.createUser(
      {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName,
      },
      client,
    );

    await users.createDefaultSettings(created.id, client);

    const token = generateOpaqueToken();
    await tokens.insertEmailVerificationToken(
      created.id,
      hashToken(token),
      expiresInHours(config.auth.emailVerificationTtlHours),
      client,
    );

    return { user: created, verificationToken: token };
  });

  // L'email parte fuori dalla transazione: se il servizio SMTP è lento o giù,
  // l'account è comunque creato e l'utente può chiedere un nuovo invio.
  void sendVerificationEmail(user.email, user.display_name, verificationToken).catch((error) => {
    logger.error({ err: error, userId: user.id }, 'Invio email di verifica fallito');
  });

  const familyId = randomUUID();
  return issueSession(user, context, familyId);
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
  context: SessionContext,
): Promise<AuthResult> {
  const user = await users.findUserByEmail(email);

  // Messaggio identico che l'email esista o meno: altrimenti l'endpoint
  // diventa un modo per scoprire chi è registrato.
  const invalid = new AppError(
    401,
    'INVALID_CREDENTIALS',
    'Email o password non corretti. Riproviamo?',
  );

  if (!user) {
    // Confronto finto per non rendere distinguibile "utente inesistente" da
    // "password sbagliata" misurando il tempo di risposta.
    await verifyPassword(
      '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000',
      password,
    );
    throw invalid;
  }

  const { valid, needsRehash } = await verifyPassword(user.password_hash, password);
  if (!valid) throw invalid;

  if (!user.is_active) {
    throw new AppError(
      403,
      'ACCOUNT_DISABLED',
      'Questo account è disattivato. Scrivici se pensi sia un errore.',
    );
  }

  if (needsRehash) {
    const upgraded = await hashPassword(password);
    await users.updatePasswordHash(user.id, upgraded);
  }

  await users.updateLastLogin(user.id);

  const familyId = randomUUID();
  const result = await issueSession(user, context, familyId);
  return { ...result, user: { ...result.user, lastLoginAt: new Date().toISOString() } };
}

// ---------------------------------------------------------------------------
// Refresh — con rotazione e rilevamento del riuso
// ---------------------------------------------------------------------------

export async function refresh(refreshToken: string, context: SessionContext): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(refreshToken);

  return withTransaction(async (client) => {
    const stored = await tokens.findRefreshToken(tokenHash, client);

    if (!stored) {
      throw AppError.unauthenticated('Sessione non valida. Accedi di nuovo.');
    }

    if (stored.revoked_at) {
      throw new AppError(401, 'TOKEN_REUSED', 'Sessione non più valida. Accedi di nuovo.');
    }

    // Il caso importante: un token già consumato che ritorna. O è una copia
    // rubata, o è un client che ha ritentato dopo aver perso la risposta. In
    // entrambi i casi la reazione sicura è la stessa: buttare via la catena.
    if (stored.used_at) {
      const revoked = await tokens.revokeTokenFamily(stored.family_id, 'reuse_detected', client);
      logger.warn(
        { userId: stored.user_id, familyId: stored.family_id, revoked },
        'Riuso di un refresh token: famiglia revocata',
      );
      throw new AppError(
        401,
        'TOKEN_REUSED',
        'Per sicurezza abbiamo chiuso questa sessione. Accedi di nuovo.',
      );
    }

    if (stored.expires_at.getTime() <= Date.now()) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'La sessione è scaduta. Accedi di nuovo.');
    }

    const user = await users.findUserById(stored.user_id, client);
    if (!user) throw AppError.unauthenticated('Sessione non valida.');
    if (!user.is_active) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Questo account è disattivato.');
    }

    await tokens.markRefreshTokenUsed(stored.id, client);

    // Il nuovo token resta nella stessa famiglia: la catena è tracciabile.
    return issueSession(user, context, stored.family_id, client);
  });
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(refreshToken: string): Promise<void> {
  const stored = await tokens.findRefreshToken(hashRefreshToken(refreshToken));
  // Un logout con un token già scaduto o inesistente non è un errore: l'utente
  // voleva uscire, ed è uscito.
  if (stored) {
    await tokens.revokeTokenFamily(stored.family_id, 'logout');
  }
}

export async function logoutEverywhere(userId: string): Promise<number> {
  return tokens.revokeAllUserTokens(userId, 'logout_all');
}

// ---------------------------------------------------------------------------
// Verifica email
// ---------------------------------------------------------------------------

export async function verifyEmail(token: string): Promise<void> {
  const consumed = await tokens.consumeEmailVerificationToken(hashToken(token));
  if (!consumed) {
    throw AppError.validation('Questo link non è più valido. Puoi chiederne un altro dall\'app.');
  }
  await users.markEmailVerified(consumed.user_id);
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const user = await users.findUserById(userId);
  if (!user) throw AppError.notFound();
  if (user.email_verified_at) return;

  const token = generateOpaqueToken();
  await tokens.insertEmailVerificationToken(
    user.id,
    hashToken(token),
    expiresInHours(config.auth.emailVerificationTtlHours),
  );
  await sendVerificationEmail(user.email, user.display_name, token);
}

// ---------------------------------------------------------------------------
// Password dimenticata / reset
// ---------------------------------------------------------------------------

/**
 * Avvia il reset password.
 *
 * Non rivela mai se l'email esiste: la risposta è identica in ogni caso.
 * Altrimenti chiunque potrebbe usare questo endpoint per verificare se una
 * persona è iscritta.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await users.findUserByEmail(email);
  if (!user || !user.is_active) return;

  const token = generateOpaqueToken();
  await tokens.insertPasswordResetToken(
    user.id,
    hashToken(token),
    expiresInMinutes(config.auth.passwordResetTtlMinutes),
  );

  await sendPasswordResetEmail(user.email, user.display_name, token).catch((error) => {
    logger.error({ err: error, userId: user.id }, 'Invio email di reset fallito');
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  validatePasswordStrength(newPassword);

  const consumed = await tokens.consumePasswordResetToken(hashToken(token));
  if (!consumed) {
    throw AppError.validation(
      'Questo link non è più valido o è scaduto. Chiedine uno nuovo dall\'app.',
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await withTransaction(async (client) => {
    await users.updatePasswordHash(consumed.user_id, passwordHash, client);
    await tokens.invalidateOpenPasswordResets(consumed.user_id, client);
    // Cambiare password chiude tutte le sessioni: è il comportamento che ci si
    // aspetta se il motivo del reset è che qualcun altro aveva accesso.
    await tokens.revokeAllUserTokens(consumed.user_id, 'password_reset', client);
  });

  const user = await users.findUserById(consumed.user_id);
  if (user) {
    void sendPasswordChangedEmail(user.email, user.display_name).catch(() => undefined);
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await users.findUserById(userId);
  if (!user) throw AppError.notFound();

  const { valid } = await verifyPassword(user.password_hash, currentPassword);
  if (!valid) {
    throw new AppError(400, 'INVALID_CREDENTIALS', 'La password attuale non è corretta.');
  }

  validatePasswordStrength(newPassword);
  const passwordHash = await hashPassword(newPassword);

  await withTransaction(async (client) => {
    await users.updatePasswordHash(userId, passwordHash, client);
    await tokens.revokeAllUserTokens(userId, 'password_changed', client);
  });

  void sendPasswordChangedEmail(user.email, user.display_name).catch(() => undefined);
}
