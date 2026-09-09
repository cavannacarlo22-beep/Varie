-- FILE: backend/database/migrations/001_initial_schema.sql
-- Nina — schema iniziale.
--
-- Convenzioni:
--   * identificativi UUID generati dal database (gen_random_uuid)
--   * ogni timestamp è TIMESTAMPTZ: il fuso lo decide chi legge, non chi scrive
--   * soft delete (deleted_at) su tutto ciò che si sincronizza, così la
--     cancellazione può viaggiare verso gli altri dispositivi
--   * sync_seq / version / client_updated_at servono al motore di
--     sincronizzazione, vedi 003_constraints.sql per i trigger che li popolano

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Registro delle migration applicate
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum    TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------

CREATE TYPE user_role         AS ENUM ('USER', 'ADMIN');
CREATE TYPE task_priority     AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE repeat_type       AS ENUM ('NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');
CREATE TYPE habit_frequency   AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM');
CREATE TYPE mood_kind         AS ENUM ('FANTASTICA', 'BENE', 'COSI_COSI', 'STANCA', 'GIU', 'NERVOSA');
CREATE TYPE friend_author     AS ENUM ('USER', 'NINA');

-- ---------------------------------------------------------------------------
-- Utenti
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              TEXT        NOT NULL,
    password_hash      TEXT        NOT NULL,
    first_name         TEXT        NOT NULL,
    last_name          TEXT        NOT NULL,
    display_name       TEXT        NOT NULL,
    avatar_url         TEXT,
    role               user_role   NOT NULL DEFAULT 'USER',
    is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
    email_verified_at  TIMESTAMPTZ,
    last_login_at      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN users.email IS 'Sempre in minuscolo: la normalizzazione avviene nel backend ed è imposta da un CHECK.';
COMMENT ON COLUMN users.display_name IS 'Come l''utente vuole essere chiamata da Nina. Chiesto durante l''onboarding.';

-- Contatore monotòno per utente: è la spina dorsale della sincronizzazione.
CREATE TABLE sync_sequence (
    user_id  UUID   PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current  BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE devices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id     TEXT NOT NULL,
    name          TEXT,
    platform      TEXT,
    app_version   TEXT,
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN devices.device_id IS 'Identificativo generato dal client e conservato in Keychain. Non è l''IDFV di Apple.';

-- ---------------------------------------------------------------------------
-- Sessioni e token
-- ---------------------------------------------------------------------------

-- I refresh token non sono JWT: sono stringhe casuali opache, salvate solo
-- come hash. Un dump del database non permette di creare sessioni valide.
CREATE TABLE refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL,
    family_id    UUID NOT NULL,
    device_id    TEXT,
    user_agent   TEXT,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at      TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    revoked_reason TEXT
);

COMMENT ON COLUMN refresh_tokens.family_id IS
    'Tutti i token nati dalla stessa login condividono la famiglia. Se un token già usato ritorna, si revoca l''intera famiglia: è la firma di un furto.';

CREATE TABLE email_verification_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Impostazioni
-- ---------------------------------------------------------------------------

CREATE TABLE user_settings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    morning_notifications       BOOLEAN NOT NULL DEFAULT TRUE,
    evening_notifications       BOOLEAN NOT NULL DEFAULT TRUE,
    task_notifications          BOOLEAN NOT NULL DEFAULT TRUE,
    habit_notifications         BOOLEAN NOT NULL DEFAULT TRUE,
    self_care_notifications     BOOLEAN NOT NULL DEFAULT TRUE,
    dark_mode                   TEXT    NOT NULL DEFAULT 'SYSTEM',
    morning_time                TIME    NOT NULL DEFAULT '08:00',
    evening_time                TIME    NOT NULL DEFAULT '21:30',
    week_starts_on_monday       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    version                     BIGINT  NOT NULL DEFAULT 1,
    sync_seq                    BIGINT  NOT NULL DEFAULT 0,
    client_updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id              TEXT
);

-- ---------------------------------------------------------------------------
-- To Do
-- ---------------------------------------------------------------------------

CREATE TABLE tasks (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                       TEXT NOT NULL,
    description                 TEXT,
    date                        DATE NOT NULL,
    time                        TIME,
    is_completed                BOOLEAN NOT NULL DEFAULT FALSE,
    priority                    task_priority NOT NULL DEFAULT 'MEDIUM',
    category                    TEXT NOT NULL DEFAULT 'ALTRO',
    notes                       TEXT,
    repeat_type                 repeat_type NOT NULL DEFAULT 'NEVER',
    repeat_days                 SMALLINT[] NOT NULL DEFAULT '{}',
    repeat_until                DATE,
    series_id                   UUID,
    notification_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    notification_minutes_before INTEGER NOT NULL DEFAULT 15,
    completed_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ,
    version                     BIGINT NOT NULL DEFAULT 1,
    sync_seq                    BIGINT NOT NULL DEFAULT 0,
    client_updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id              TEXT
);

COMMENT ON COLUMN tasks.repeat_days IS 'Giorni della settimana per la ripetizione personalizzata: 1 = lunedì … 7 = domenica (ISO 8601).';
COMMENT ON COLUMN tasks.series_id IS 'Le occorrenze generate da una ripetizione condividono la serie, così si possono modificare o cancellare tutte insieme.';

-- ---------------------------------------------------------------------------
-- Abitudini
-- ---------------------------------------------------------------------------

CREATE TABLE habits (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    icon               TEXT NOT NULL DEFAULT '✨',
    color              TEXT NOT NULL DEFAULT '#F48FB1',
    frequency          habit_frequency NOT NULL DEFAULT 'DAILY',
    target_days        SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',
    target_per_week    SMALLINT,
    reminder_time      TIME,
    sort_order         INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 1,
    sync_seq           BIGINT NOT NULL DEFAULT 0,
    client_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id     TEXT
);

CREATE TABLE habit_completions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id           UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date               DATE NOT NULL,
    completed          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 1,
    sync_seq           BIGINT NOT NULL DEFAULT 0,
    client_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id     TEXT
);

-- ---------------------------------------------------------------------------
-- Mood
-- ---------------------------------------------------------------------------

CREATE TABLE moods (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mood               mood_kind NOT NULL,
    note               TEXT,
    date               DATE NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 1,
    sync_seq           BIGINT NOT NULL DEFAULT 0,
    client_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id     TEXT
);

-- ---------------------------------------------------------------------------
-- Diario — contenuto privato, nessun endpoint amministrativo lo espone
-- ---------------------------------------------------------------------------

CREATE TABLE diary_entries (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title              TEXT,
    content            TEXT NOT NULL,
    mood               mood_kind,
    entry_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 1,
    sync_seq           BIGINT NOT NULL DEFAULT 0,
    client_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id     TEXT
);

COMMENT ON TABLE diary_entries IS
    'Contenuto privato dell''utente. Nessuna rotta /admin legge questa tabella; le statistiche contano solo le righe.';

-- ---------------------------------------------------------------------------
-- Wishlist
-- ---------------------------------------------------------------------------

CREATE TABLE wishlist (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title              TEXT NOT NULL,
    description        TEXT,
    price              NUMERIC(12,2),
    currency           TEXT NOT NULL DEFAULT 'EUR',
    image_url          TEXT,
    product_url        TEXT,
    category           TEXT NOT NULL DEFAULT 'ALTRO',
    is_purchased       BOOLEAN NOT NULL DEFAULT FALSE,
    purchased_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 1,
    sync_seq           BIGINT NOT NULL DEFAULT 0,
    client_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id     TEXT
);

-- ---------------------------------------------------------------------------
-- Note veloci ("Devo ricordarmi…")
-- ---------------------------------------------------------------------------

CREATE TABLE quick_notes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content            TEXT NOT NULL,
    converted_task_id  UUID REFERENCES tasks(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 1,
    sync_seq           BIGINT NOT NULL DEFAULT 0,
    client_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id     TEXT
);

-- ---------------------------------------------------------------------------
-- "La mia amica" — conversazione
-- ---------------------------------------------------------------------------

CREATE TABLE friend_messages (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author             friend_author NOT NULL,
    content            TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            BIGINT NOT NULL DEFAULT 1,
    sync_seq           BIGINT NOT NULL DEFAULT 0,
    client_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_device_id     TEXT
);

COMMENT ON TABLE friend_messages IS
    'Conversazione privata come il diario: nessun endpoint amministrativo la legge.';

-- ---------------------------------------------------------------------------
-- Contenuti globali gestiti dall''admin
-- ---------------------------------------------------------------------------

CREATE TABLE motivation_quotes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text        TEXT NOT NULL,
    author      TEXT,
    source      TEXT,
    language    TEXT NOT NULL DEFAULT 'it',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE self_care_ideas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    description  TEXT,
    category     TEXT NOT NULL DEFAULT 'RELAX',
    duration_min INTEGER,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Frasi messe tra i preferiti dall''utente.
CREATE TABLE quote_favorites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quote_id    UUID NOT NULL REFERENCES motivation_quotes(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quale frase è stata mostrata a quale utente in quale giorno: garantisce che
-- "il pensiero di oggi" sia stabile durante la giornata e diverso da ieri.
CREATE TABLE daily_quote_assignments (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    quote_id    UUID NOT NULL REFERENCES motivation_quotes(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, date)
);

-- ---------------------------------------------------------------------------
-- Tracciamento azioni amministrative
-- ---------------------------------------------------------------------------

CREATE TABLE admin_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   UUID,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_audit_log IS
    'Registra cosa fa un admin. Non contiene mai contenuti privati degli utenti.';

COMMIT;
