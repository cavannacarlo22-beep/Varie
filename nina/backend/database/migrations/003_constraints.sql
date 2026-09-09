-- FILE: backend/database/migrations/003_constraints.sql
-- Nina — vincoli di integrità e motore di sincronizzazione lato database.
--
-- Il principio è: ciò che non deve mai accadere non deve essere possibile.
-- Un dato incoerente rifiutato dal database è un bug trovato subito; lo stesso
-- dato accettato è un bug che si scopre mesi dopo su un dispositivo altrui.

BEGIN;

-- ===========================================================================
-- 1. Sincronizzazione
-- ===========================================================================

-- Restituisce il numero successivo del contatore dell'utente.
-- L'INSERT ... ON CONFLICT DO UPDATE è atomico: due transazioni concorrenti
-- non possono ottenere lo stesso numero, la seconda aspetta la prima.
CREATE OR REPLACE FUNCTION nina_next_sync_seq(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    INSERT INTO sync_sequence AS s (user_id, current)
         VALUES (p_user_id, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET current = s.current + 1
      RETURNING s.current INTO v_next;

    RETURN v_next;
END;
$$;

COMMENT ON FUNCTION nina_next_sync_seq(UUID) IS
    'Contatore monotòno per utente. Ogni riga sincronizzabile riceve un numero crescente a ogni scrittura, così un client può chiedere "cosa è cambiato dopo N".';

-- Trigger applicato a tutte le tabelle sincronizzabili.
CREATE OR REPLACE FUNCTION nina_touch_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();

    IF TG_OP = 'UPDATE' THEN
        -- created_at è immutabile: nessun percorso di scrittura può riscriverlo.
        NEW.created_at := OLD.created_at;
        NEW.version    := OLD.version + 1;
    END IF;

    NEW.sync_seq := nina_next_sync_seq(NEW.user_id);

    RETURN NEW;
END;
$$;

-- Per le tabelle globali, che non appartengono a un utente e non si
-- sincronizzano per cursore.
CREATE OR REPLACE FUNCTION nina_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    IF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_sync             BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();
CREATE TRIGGER trg_habits_sync            BEFORE INSERT OR UPDATE ON habits
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();
CREATE TRIGGER trg_habit_completions_sync BEFORE INSERT OR UPDATE ON habit_completions
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();
CREATE TRIGGER trg_moods_sync             BEFORE INSERT OR UPDATE ON moods
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();
CREATE TRIGGER trg_diary_sync             BEFORE INSERT OR UPDATE ON diary_entries
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();
CREATE TRIGGER trg_wishlist_sync          BEFORE INSERT OR UPDATE ON wishlist
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();
CREATE TRIGGER trg_quick_notes_sync       BEFORE INSERT OR UPDATE ON quick_notes
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();
CREATE TRIGGER trg_friend_messages_sync   BEFORE INSERT OR UPDATE ON friend_messages
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();
CREATE TRIGGER trg_user_settings_sync     BEFORE INSERT OR UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION nina_touch_sync();

CREATE TRIGGER trg_users_touch            BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION nina_touch_updated_at();
CREATE TRIGGER trg_quotes_touch           BEFORE UPDATE ON motivation_quotes
    FOR EACH ROW EXECUTE FUNCTION nina_touch_updated_at();
CREATE TRIGGER trg_self_care_touch        BEFORE UPDATE ON self_care_ideas
    FOR EACH ROW EXECUTE FUNCTION nina_touch_updated_at();

-- ===========================================================================
-- 2. Chiavi composte: un figlio non può appartenere a un altro utente
-- ===========================================================================

-- Senza questi vincoli, un bug nel backend potrebbe legare il completamento di
-- un'abitudine di Anna all'utente Bea. Con questi vincoli, il database rifiuta.
ALTER TABLE habits ADD CONSTRAINT habits_id_user_key UNIQUE (id, user_id);
ALTER TABLE tasks  ADD CONSTRAINT tasks_id_user_key  UNIQUE (id, user_id);

ALTER TABLE habit_completions
    ADD CONSTRAINT habit_completions_same_user_fk
    FOREIGN KEY (habit_id, user_id) REFERENCES habits (id, user_id) ON DELETE CASCADE;

ALTER TABLE quick_notes
    ADD CONSTRAINT quick_notes_task_same_user_fk
    FOREIGN KEY (converted_task_id, user_id) REFERENCES tasks (id, user_id) ON DELETE SET NULL;

-- ===========================================================================
-- 3. Unicità applicative
-- ===========================================================================

-- Un solo mood per giorno: la schermata chiede "come stai oggi", non "quante
-- volte sei stata bene oggi". Le righe cancellate sono escluse, così si può
-- cancellare e reinserire.
CREATE UNIQUE INDEX moods_one_per_day_key
    ON moods (user_id, date) WHERE deleted_at IS NULL;

-- Un'abitudine si spunta una volta al giorno.
CREATE UNIQUE INDEX habit_completions_one_per_day_key
    ON habit_completions (habit_id, date) WHERE deleted_at IS NULL;

-- ===========================================================================
-- 4. Vincoli di validità
-- ===========================================================================

ALTER TABLE users
    ADD CONSTRAINT users_email_lowercase_chk CHECK (email = lower(email)),
    ADD CONSTRAINT users_email_shape_chk     CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    ADD CONSTRAINT users_first_name_chk      CHECK (length(btrim(first_name))   BETWEEN 1 AND 80),
    ADD CONSTRAINT users_last_name_chk       CHECK (length(btrim(last_name))    BETWEEN 1 AND 80),
    ADD CONSTRAINT users_display_name_chk    CHECK (length(btrim(display_name)) BETWEEN 1 AND 40),
    ADD CONSTRAINT users_password_hash_chk   CHECK (length(password_hash) >= 20);

ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_dark_mode_chk
        CHECK (dark_mode IN ('LIGHT', 'DARK', 'SYSTEM')),
    ADD CONSTRAINT user_settings_version_chk CHECK (version > 0);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_title_chk
        CHECK (length(btrim(title)) BETWEEN 1 AND 200),
    ADD CONSTRAINT tasks_category_chk
        CHECK (category IN ('LAVORO','CASA','PERSONALE','SPORT','STUDIO','SHOPPING','SOCIAL','ALTRO')),
    ADD CONSTRAINT tasks_notification_lead_chk
        CHECK (notification_minutes_before BETWEEN 0 AND 10080),
    ADD CONSTRAINT tasks_repeat_days_chk
        CHECK (repeat_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
    -- Una ripetizione personalizzata senza giorni non si ripeterebbe mai.
    -- cardinality() e non array_length(): su un array vuoto array_length
    -- restituisce NULL, e un CHECK che vale NULL viene considerato superato.
    ADD CONSTRAINT tasks_custom_repeat_chk
        CHECK (repeat_type <> 'CUSTOM' OR cardinality(repeat_days) >= 1),
    -- "Completata" e "quando è stata completata" non possono contraddirsi.
    ADD CONSTRAINT tasks_completed_coherent_chk
        CHECK ((is_completed = FALSE AND completed_at IS NULL)
            OR (is_completed = TRUE  AND completed_at IS NOT NULL)),
    ADD CONSTRAINT tasks_version_chk CHECK (version > 0);

ALTER TABLE habits
    ADD CONSTRAINT habits_name_chk
        CHECK (length(btrim(name)) BETWEEN 1 AND 80),
    ADD CONSTRAINT habits_color_chk
        CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    ADD CONSTRAINT habits_target_days_chk
        CHECK (target_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
    ADD CONSTRAINT habits_target_per_week_chk
        CHECK (target_per_week IS NULL OR target_per_week BETWEEN 1 AND 7),
    ADD CONSTRAINT habits_weekly_target_chk
        CHECK (frequency <> 'WEEKLY' OR target_per_week IS NOT NULL),
    ADD CONSTRAINT habits_version_chk CHECK (version > 0);

ALTER TABLE habit_completions
    ADD CONSTRAINT habit_completions_version_chk CHECK (version > 0);

ALTER TABLE moods
    ADD CONSTRAINT moods_note_chk
        CHECK (note IS NULL OR length(note) <= 2000),
    ADD CONSTRAINT moods_version_chk CHECK (version > 0);

ALTER TABLE diary_entries
    ADD CONSTRAINT diary_content_chk
        CHECK (length(btrim(content)) BETWEEN 1 AND 50000),
    ADD CONSTRAINT diary_title_chk
        CHECK (title IS NULL OR length(title) <= 200),
    ADD CONSTRAINT diary_version_chk CHECK (version > 0);

ALTER TABLE wishlist
    ADD CONSTRAINT wishlist_title_chk
        CHECK (length(btrim(title)) BETWEEN 1 AND 200),
    ADD CONSTRAINT wishlist_price_chk
        CHECK (price IS NULL OR price >= 0),
    ADD CONSTRAINT wishlist_currency_chk
        CHECK (currency ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT wishlist_category_chk
        CHECK (category IN ('MODA','BEAUTY','CASA','TECH','VIAGGI','LIBRI','ESPERIENZE','ALTRO')),
    ADD CONSTRAINT wishlist_purchased_coherent_chk
        CHECK ((is_purchased = FALSE AND purchased_at IS NULL)
            OR (is_purchased = TRUE  AND purchased_at IS NOT NULL)),
    ADD CONSTRAINT wishlist_version_chk CHECK (version > 0);

ALTER TABLE quick_notes
    ADD CONSTRAINT quick_notes_content_chk
        CHECK (length(btrim(content)) BETWEEN 1 AND 1000),
    ADD CONSTRAINT quick_notes_version_chk CHECK (version > 0);

ALTER TABLE friend_messages
    ADD CONSTRAINT friend_messages_content_chk
        CHECK (length(btrim(content)) BETWEEN 1 AND 4000),
    ADD CONSTRAINT friend_messages_version_chk CHECK (version > 0);

ALTER TABLE motivation_quotes
    ADD CONSTRAINT quotes_text_chk
        CHECK (length(btrim(text)) BETWEEN 1 AND 500),
    ADD CONSTRAINT quotes_language_chk
        CHECK (language ~ '^[a-z]{2}$');

ALTER TABLE self_care_ideas
    ADD CONSTRAINT self_care_title_chk
        CHECK (length(btrim(title)) BETWEEN 1 AND 200),
    ADD CONSTRAINT self_care_category_chk
        CHECK (category IN ('RELAX','CORPO','MENTE','CASA','FUORI','CREATIVITA','SOCIAL','DIGITALE')),
    ADD CONSTRAINT self_care_duration_chk
        CHECK (duration_min IS NULL OR duration_min BETWEEN 1 AND 480);

ALTER TABLE devices
    ADD CONSTRAINT devices_device_id_chk
        CHECK (length(btrim(device_id)) BETWEEN 8 AND 128);

ALTER TABLE refresh_tokens
    ADD CONSTRAINT refresh_tokens_expiry_chk CHECK (expires_at > created_at);
ALTER TABLE email_verification_tokens
    ADD CONSTRAINT email_verif_expiry_chk    CHECK (expires_at > created_at);
ALTER TABLE password_reset_tokens
    ADD CONSTRAINT pwd_reset_expiry_chk      CHECK (expires_at > created_at);

COMMIT;
