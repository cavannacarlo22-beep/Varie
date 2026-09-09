// FILE: backend/src/repositories/tokenRepository.ts

import type { DbClient } from '../db/pool.js';
import { execute, queryOne, sql } from '../db/sql.js';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  device_id: string | null;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
}

export async function insertRefreshToken(
  input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    deviceId: string | null;
    userAgent: string | null;
    expiresAt: Date;
  },
  client?: DbClient,
): Promise<void> {
  await execute(
    sql`INSERT INTO refresh_tokens (user_id, token_hash, family_id, device_id, user_agent, expires_at)
        VALUES (${input.userId}, ${input.tokenHash}, ${input.familyId},
                ${input.deviceId}, ${input.userAgent}, ${input.expiresAt})`,
    client,
  );
}

export async function findRefreshToken(
  tokenHash: string,
  client?: DbClient,
): Promise<RefreshTokenRow | undefined> {
  return queryOne<RefreshTokenRow>(
    sql`SELECT id, user_id, token_hash, family_id, device_id, expires_at, used_at, revoked_at
          FROM refresh_tokens
         WHERE token_hash = ${tokenHash}`,
    client,
  );
}

export async function markRefreshTokenUsed(id: string, client?: DbClient): Promise<void> {
  await execute(sql`UPDATE refresh_tokens SET used_at = now() WHERE id = ${id}`, client);
}

export async function revokeRefreshToken(
  id: string,
  reason: string,
  client?: DbClient,
): Promise<void> {
  await execute(
    sql`UPDATE refresh_tokens
           SET revoked_at = now(), revoked_reason = ${reason}
         WHERE id = ${id} AND revoked_at IS NULL`,
    client,
  );
}

/**
 * Revoca un'intera famiglia di token.
 *
 * Serve in due casi: logout esplicito da un dispositivo, e — soprattutto —
 * rilevamento di riuso. Se un refresh token già consumato ritorna, significa
 * che qualcuno ne ha una copia: si butta via tutta la catena e si costringe a
 * un nuovo login.
 */
export async function revokeTokenFamily(
  familyId: string,
  reason: string,
  client?: DbClient,
): Promise<number> {
  return execute(
    sql`UPDATE refresh_tokens
           SET revoked_at = now(), revoked_reason = ${reason}
         WHERE family_id = ${familyId} AND revoked_at IS NULL`,
    client,
  );
}

export async function revokeAllUserTokens(
  userId: string,
  reason: string,
  client?: DbClient,
): Promise<number> {
  return execute(
    sql`UPDATE refresh_tokens
           SET revoked_at = now(), revoked_reason = ${reason}
         WHERE user_id = ${userId} AND revoked_at IS NULL`,
    client,
  );
}

/** Pulizia periodica: i token scaduti da più di 30 giorni non servono a niente. */
export async function deleteExpiredTokens(client?: DbClient): Promise<number> {
  const deleted = await execute(
    sql`DELETE FROM refresh_tokens WHERE expires_at < now() - INTERVAL '30 days'`,
    client,
  );
  await execute(
    sql`DELETE FROM email_verification_tokens WHERE expires_at < now() - INTERVAL '30 days'`,
    client,
  );
  await execute(
    sql`DELETE FROM password_reset_tokens WHERE expires_at < now() - INTERVAL '30 days'`,
    client,
  );
  return deleted;
}

// --- Token monouso: verifica email e reset password -------------------------

export interface SingleUseTokenRow {
  id: string;
  user_id: string;
  expires_at: Date;
  used_at: Date | null;
}

export async function insertEmailVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  client?: DbClient,
): Promise<void> {
  await execute(
    sql`INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES (${userId}, ${tokenHash}, ${expiresAt})`,
    client,
  );
}

export async function consumeEmailVerificationToken(
  tokenHash: string,
  client?: DbClient,
): Promise<SingleUseTokenRow | undefined> {
  // L'UPDATE ... RETURNING con la condizione "non ancora usato e non scaduto"
  // rende il consumo atomico: due richieste contemporanee con lo stesso token
  // non possono riuscire entrambe.
  return queryOne<SingleUseTokenRow>(
    sql`UPDATE email_verification_tokens
           SET used_at = now()
         WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
        RETURNING id, user_id, expires_at, used_at`,
    client,
  );
}

export async function insertPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  client?: DbClient,
): Promise<void> {
  await execute(
    sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (${userId}, ${tokenHash}, ${expiresAt})`,
    client,
  );
}

export async function consumePasswordResetToken(
  tokenHash: string,
  client?: DbClient,
): Promise<SingleUseTokenRow | undefined> {
  return queryOne<SingleUseTokenRow>(
    sql`UPDATE password_reset_tokens
           SET used_at = now()
         WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
        RETURNING id, user_id, expires_at, used_at`,
    client,
  );
}

/** Invalida eventuali richieste di reset ancora aperte per quell'utente. */
export async function invalidateOpenPasswordResets(
  userId: string,
  client?: DbClient,
): Promise<void> {
  await execute(
    sql`UPDATE password_reset_tokens
           SET used_at = now()
         WHERE user_id = ${userId} AND used_at IS NULL`,
    client,
  );
}

// --- Dispositivi ------------------------------------------------------------

export async function registerDevice(
  input: {
    userId: string;
    deviceId: string;
    name: string | null;
    platform: string | null;
    appVersion: string | null;
  },
  client?: DbClient,
): Promise<void> {
  await execute(
    sql`INSERT INTO devices (user_id, device_id, name, platform, app_version, last_seen_at)
        VALUES (${input.userId}, ${input.deviceId}, ${input.name}, ${input.platform},
                ${input.appVersion}, now())
        ON CONFLICT (user_id, device_id)
        DO UPDATE SET last_seen_at = now(),
                      name         = COALESCE(EXCLUDED.name, devices.name),
                      platform     = COALESCE(EXCLUDED.platform, devices.platform),
                      app_version  = COALESCE(EXCLUDED.app_version, devices.app_version)`,
    client,
  );
}
