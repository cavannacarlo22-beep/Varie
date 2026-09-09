// FILE: backend/src/repositories/userRepository.ts

import type { DbClient } from '../db/pool.js';
import { execute, queryOne, queryRows, raw, sql } from '../db/sql.js';
import type { UserRow, UserRole } from '../types/domain.js';

// Costante del codice, non input utente: è esattamente il caso per cui `raw`
// esiste. L'elenco è scritto una volta sola così non può divergere fra query.
const COLS = raw(`id, email, password_hash, first_name, last_name, display_name,
                  avatar_url, role, is_active, email_verified_at, last_login_at,
                  created_at, updated_at`);

/** Le email si confrontano sempre normalizzate: minuscole e senza spazi. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(
  email: string,
  client?: DbClient,
): Promise<UserRow | undefined> {
  return queryOne<UserRow>(
    sql`SELECT ${COLS} FROM users WHERE email = ${normalizeEmail(email)}`,
    client,
  );
}

export async function findUserById(id: string, client?: DbClient): Promise<UserRow | undefined> {
  return queryOne<UserRow>(sql`SELECT ${COLS} FROM users WHERE id = ${id}`, client);
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role?: UserRole;
}

export async function createUser(input: CreateUserInput, client?: DbClient): Promise<UserRow> {
  const row = await queryOne<UserRow>(
    sql`INSERT INTO users (email, password_hash, first_name, last_name, display_name, role)
        VALUES (${normalizeEmail(input.email)}, ${input.passwordHash}, ${input.firstName.trim()},
                ${input.lastName.trim()}, ${input.displayName.trim()}, ${input.role ?? 'USER'})
        RETURNING ${COLS}`,
    client,
  );
  if (!row) throw new Error('createUser non ha restituito la riga inserita');
  return row;
}

/** Crea la riga di impostazioni predefinite per un nuovo account. */
export async function createDefaultSettings(userId: string, client?: DbClient): Promise<void> {
  await execute(sql`INSERT INTO user_settings (user_id) VALUES (${userId})`, client);
}

export async function updateLastLogin(userId: string, client?: DbClient): Promise<void> {
  await execute(sql`UPDATE users SET last_login_at = now() WHERE id = ${userId}`, client);
}

export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
  client?: DbClient,
): Promise<void> {
  await execute(
    sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`,
    client,
  );
}

export async function markEmailVerified(userId: string, client?: DbClient): Promise<void> {
  await execute(
    sql`UPDATE users SET email_verified_at = now() WHERE id = ${userId} AND email_verified_at IS NULL`,
    client,
  );
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
  client?: DbClient,
): Promise<UserRow | undefined> {
  // COALESCE con parametri: i campi non inviati restano invariati, senza
  // costruire SQL dinamico.
  return queryOne<UserRow>(
    sql`UPDATE users
           SET first_name   = COALESCE(${input.firstName ?? null}, first_name),
               last_name    = COALESCE(${input.lastName ?? null}, last_name),
               display_name = COALESCE(${input.displayName ?? null}, display_name),
               avatar_url   = CASE WHEN ${input.avatarUrl === undefined} THEN avatar_url
                                   ELSE ${input.avatarUrl ?? null} END
         WHERE id = ${userId}
        RETURNING ${COLS}`,
    client,
  );
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  client?: DbClient,
): Promise<void> {
  await execute(sql`UPDATE users SET is_active = ${isActive} WHERE id = ${userId}`, client);
}

/**
 * Cancellazione definitiva dell'account.
 *
 * Tutte le tabelle hanno ON DELETE CASCADE su user_id, quindi questa singola
 * riga rimuove davvero ogni dato dell'utente: attività, abitudini, diario,
 * wishlist, sessioni. Non è un flag: è una cancellazione.
 */
export async function deleteUserPermanently(userId: string, client?: DbClient): Promise<number> {
  return execute(sql`DELETE FROM users WHERE id = ${userId}`, client);
}

export async function countUsers(client?: DbClient): Promise<number> {
  const row = await queryOne<{ count: string }>(sql`SELECT count(*)::text AS count FROM users`, client);
  return Number.parseInt(row?.count ?? '0', 10);
}

export interface AdminUserListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  email_verified_at: Date | null;
  created_at: Date;
  last_login_at: Date | null;
  task_count: string;
  habit_count: string;
  diary_count: string;
}

/**
 * Elenco utenti per il pannello amministratore.
 *
 * Nota bene: `diary_count` conta le righe, non le legge. Nessuna query di
 * questo file restituisce mai `diary_entries.content`.
 */
export async function listUsersForAdmin(
  limit: number,
  offset: number,
  search: string | null,
  client?: DbClient,
): Promise<AdminUserListItem[]> {
  const pattern = search ? `%${search.trim().toLowerCase()}%` : null;

  return queryRows<AdminUserListItem>(
    sql`SELECT u.id, u.email, u.first_name, u.last_name, u.display_name, u.role,
               u.is_active, u.email_verified_at, u.created_at, u.last_login_at,
               (SELECT count(*)::text FROM tasks t
                 WHERE t.user_id = u.id AND t.deleted_at IS NULL)          AS task_count,
               (SELECT count(*)::text FROM habits h
                 WHERE h.user_id = u.id AND h.deleted_at IS NULL)          AS habit_count,
               (SELECT count(*)::text FROM diary_entries d
                 WHERE d.user_id = u.id AND d.deleted_at IS NULL)          AS diary_count
          FROM users u
         WHERE ${pattern}::text IS NULL
            OR lower(u.email) LIKE ${pattern}
            OR lower(u.first_name || ' ' || u.last_name) LIKE ${pattern}
         ORDER BY u.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
    client,
  );
}
