-- FILE: backend/database/migrations/002_indexes.sql
-- Nina — indici.
--
-- Ogni indice qui sotto esiste per una query precisa che il backend esegue
-- davvero. Gli indici parziali "WHERE deleted_at IS NULL" servono perché le
-- letture normali ignorano le righe cancellate: l'indice resta piccolo anche
-- quando lo storico cresce.

BEGIN;

-- ---------------------------------------------------------------------------
-- Utenti, dispositivi, sessioni
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX users_email_key            ON users (email);
CREATE INDEX        users_role_idx             ON users (role) WHERE role = 'ADMIN';
CREATE INDEX        users_created_at_idx       ON users (created_at DESC);

CREATE UNIQUE INDEX devices_user_device_key    ON devices (user_id, device_id);
CREATE INDEX        devices_last_seen_idx      ON devices (user_id, last_seen_at DESC);

CREATE UNIQUE INDEX refresh_tokens_hash_key    ON refresh_tokens (token_hash);
CREATE INDEX        refresh_tokens_user_idx    ON refresh_tokens (user_id);
CREATE INDEX        refresh_tokens_family_idx  ON refresh_tokens (family_id);
-- Usato dal job di pulizia dei token scaduti.
CREATE INDEX        refresh_tokens_expiry_idx  ON refresh_tokens (expires_at)
                                               WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX email_verif_hash_key       ON email_verification_tokens (token_hash);
CREATE INDEX        email_verif_user_idx       ON email_verification_tokens (user_id);

CREATE UNIQUE INDEX pwd_reset_hash_key         ON password_reset_tokens (token_hash);
CREATE INDEX        pwd_reset_user_idx         ON password_reset_tokens (user_id);

CREATE UNIQUE INDEX user_settings_user_key     ON user_settings (user_id);

-- ---------------------------------------------------------------------------
-- Sincronizzazione
--
-- L'indice (user_id, sync_seq) è il più importante di tutto lo schema: è
-- quello che serve la query "dammi tutto ciò che è cambiato dopo il cursore N",
-- eseguita a ogni apertura dell'app e a ogni evento realtime.
-- ---------------------------------------------------------------------------

CREATE INDEX tasks_sync_idx            ON tasks            (user_id, sync_seq);
CREATE INDEX habits_sync_idx           ON habits           (user_id, sync_seq);
CREATE INDEX habit_completions_sync_idx ON habit_completions (user_id, sync_seq);
CREATE INDEX moods_sync_idx            ON moods            (user_id, sync_seq);
CREATE INDEX diary_sync_idx            ON diary_entries    (user_id, sync_seq);
CREATE INDEX wishlist_sync_idx         ON wishlist         (user_id, sync_seq);
CREATE INDEX quick_notes_sync_idx      ON quick_notes      (user_id, sync_seq);
CREATE INDEX friend_messages_sync_idx  ON friend_messages  (user_id, sync_seq);
CREATE INDEX user_settings_sync_idx    ON user_settings    (user_id, sync_seq);

-- ---------------------------------------------------------------------------
-- Query dell'app
-- ---------------------------------------------------------------------------

-- Home e calendario: le attività di un giorno o di un intervallo.
CREATE INDEX tasks_user_date_idx       ON tasks (user_id, date, time NULLS LAST)
                                       WHERE deleted_at IS NULL;
-- "Quante ne restano da fare oggi".
CREATE INDEX tasks_open_idx            ON tasks (user_id, date)
                                       WHERE deleted_at IS NULL AND is_completed = FALSE;
-- Modifica o cancellazione di un'intera serie ricorrente.
CREATE INDEX tasks_series_idx          ON tasks (series_id)
                                       WHERE series_id IS NOT NULL;
-- Statistiche di completamento.
CREATE INDEX tasks_completed_at_idx    ON tasks (user_id, completed_at DESC)
                                       WHERE deleted_at IS NULL AND is_completed = TRUE;

CREATE INDEX habits_user_idx           ON habits (user_id, sort_order)
                                       WHERE deleted_at IS NULL;

-- Streak e griglia mensile delle abitudini.
CREATE INDEX habit_completions_habit_date_idx
                                       ON habit_completions (habit_id, date DESC)
                                       WHERE deleted_at IS NULL;
CREATE INDEX habit_completions_user_date_idx
                                       ON habit_completions (user_id, date DESC)
                                       WHERE deleted_at IS NULL;

CREATE INDEX moods_user_date_idx       ON moods (user_id, date DESC)
                                       WHERE deleted_at IS NULL;

CREATE INDEX diary_user_date_idx       ON diary_entries (user_id, entry_date DESC)
                                       WHERE deleted_at IS NULL;

-- Ricerca full-text nel diario, in italiano.
CREATE INDEX diary_search_idx          ON diary_entries
                                       USING GIN (
                                           to_tsvector('italian',
                                               coalesce(title, '') || ' ' || content)
                                       )
                                       WHERE deleted_at IS NULL;

CREATE INDEX wishlist_user_idx         ON wishlist (user_id, is_purchased, created_at DESC)
                                       WHERE deleted_at IS NULL;

CREATE INDEX quick_notes_user_idx      ON quick_notes (user_id, created_at DESC)
                                       WHERE deleted_at IS NULL;

CREATE INDEX friend_messages_user_idx  ON friend_messages (user_id, created_at DESC)
                                       WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Contenuti globali
-- ---------------------------------------------------------------------------

CREATE INDEX quotes_active_idx         ON motivation_quotes (language, is_active)
                                       WHERE is_active = TRUE;
CREATE INDEX quotes_updated_idx        ON motivation_quotes (updated_at DESC);

CREATE INDEX self_care_active_idx      ON self_care_ideas (category, is_active)
                                       WHERE is_active = TRUE;
CREATE INDEX self_care_updated_idx     ON self_care_ideas (updated_at DESC);

CREATE UNIQUE INDEX quote_favorites_key ON quote_favorites (user_id, quote_id);

CREATE INDEX admin_audit_created_idx   ON admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_admin_idx     ON admin_audit_log (admin_id, created_at DESC);

COMMIT;
