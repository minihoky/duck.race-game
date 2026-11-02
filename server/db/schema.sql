-- PostgreSQL schema. Applied automatically on server start (idempotent).

CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL DEFAULT '',
  password_hash      TEXT NOT NULL DEFAULT '',
  verified           BOOLEAN NOT NULL DEFAULT FALSE,
  verify_token_hash  TEXT NOT NULL DEFAULT '',
  verify_expires     BIGINT NOT NULL DEFAULT 0,
  reset_token_hash   TEXT NOT NULL DEFAULT '',
  reset_expires      BIGINT NOT NULL DEFAULT 0,
  role               TEXT NOT NULL DEFAULT 'user',
  credits            INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'blocked')),
  status_note        TEXT NOT NULL DEFAULT '',
  created_at         BIGINT NOT NULL DEFAULT 0,
  extra              JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires     BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS packages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  credits     INTEGER NOT NULL CHECK (credits > 0),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL DEFAULT 0,
  extra       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  package_id      TEXT NOT NULL DEFAULT '',
  package_name    TEXT NOT NULL DEFAULT '',
  credits         INTEGER NOT NULL,
  amount          INTEGER NOT NULL,
  currency        TEXT NOT NULL,
  status          TEXT NOT NULL,
  gateway         TEXT NOT NULL,
  gateway_ref     TEXT NOT NULL DEFAULT '',
  gateway_status  TEXT NOT NULL DEFAULT '',
  preference_id   TEXT NOT NULL DEFAULT '',
  checkout_url    TEXT NOT NULL DEFAULT '',
  created_at      BIGINT NOT NULL,
  paid_at         BIGINT NOT NULL DEFAULT 0,
  extra           JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id);
-- A Mercado Pago payment can credit at most one checkout.
CREATE UNIQUE INDEX IF NOT EXISTS payments_paid_ref_idx ON payments(gateway, gateway_ref)
  WHERE status = 'paid' AND gateway = 'mercadopago' AND gateway_ref <> '';

CREATE TABLE IF NOT EXISTS ledger (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL,
  credits     INTEGER NOT NULL,
  balance     INTEGER NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  race_id     TEXT NOT NULL DEFAULT '',
  payment_id  TEXT NOT NULL DEFAULT '',
  actor_id    TEXT NOT NULL DEFAULT '',
  created_at  BIGINT NOT NULL,
  extra       JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ledger_user_idx ON ledger(user_id);
-- One top-up per payment and one debit per race.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_topup_idx ON ledger(payment_id) WHERE type = 'topup' AND payment_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS ledger_race_idx ON ledger(race_id) WHERE type = 'race' AND race_id <> '';

CREATE TABLE IF NOT EXISTS races (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL,
  animal       TEXT NOT NULL DEFAULT 'rabbit',
  algorithm    TEXT NOT NULL DEFAULT '',
  seed         TEXT NOT NULL DEFAULT '',
  seed_hash    TEXT NOT NULL DEFAULT '',
  names_hash   TEXT NOT NULL DEFAULT '',
  params_hash  TEXT NOT NULL DEFAULT '',
  client_seed  TEXT NOT NULL DEFAULT '',
  duration_ms  INTEGER NOT NULL,
  lead_in_ms   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL CHECK (status IN ('ready', 'racing', 'finished')),
  credit_used  BOOLEAN NOT NULL DEFAULT FALSE,
  sponsors     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   BIGINT NOT NULL DEFAULT 0,
  started_at   BIGINT NOT NULL DEFAULT 0,
  finished_at  BIGINT NOT NULL DEFAULT 0,
  extra        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS races_user_idx ON races(user_id);

CREATE TABLE IF NOT EXISTS race_participants (
  race_id    TEXT NOT NULL REFERENCES races(id),
  lane       INTEGER NOT NULL,
  name       TEXT NOT NULL,
  finish_ms  INTEGER NOT NULL DEFAULT 0,
  place      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (race_id, lane)
);

CREATE TABLE IF NOT EXISTS sponsors (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'global')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL DEFAULT 0,
  updated_at  BIGINT NOT NULL DEFAULT 0,
  extra       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sponsor_images (
  id          TEXT PRIMARY KEY,
  png         BYTEA NOT NULL,
  updated_at  BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  seq          INTEGER PRIMARY KEY,
  id           TEXT NOT NULL UNIQUE,
  at           BIGINT NOT NULL,
  actor_id     TEXT NOT NULL DEFAULT '',
  action       TEXT NOT NULL,
  target_type  TEXT NOT NULL DEFAULT '',
  target_id    TEXT NOT NULL DEFAULT '',
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash    TEXT NOT NULL,
  hash         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_target_idx ON audit_log(target_type, target_id);

-- Integrity rules enforced by the database itself, independent of the application.

CREATE OR REPLACE FUNCTION dr_forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dr_lock_race() RETURNS trigger AS $$
BEGIN
  IF NEW.seed IS DISTINCT FROM OLD.seed
     OR NEW.seed_hash IS DISTINCT FROM OLD.seed_hash
     OR NEW.names_hash IS DISTINCT FROM OLD.names_hash
     OR NEW.params_hash IS DISTINCT FROM OLD.params_hash
     OR NEW.algorithm IS DISTINCT FROM OLD.algorithm
     OR NEW.animal IS DISTINCT FROM OLD.animal
     OR NEW.duration_ms IS DISTINCT FROM OLD.duration_ms
     OR NEW.lead_in_ms IS DISTINCT FROM OLD.lead_in_ms
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'race % parameters are locked', OLD.id;
  END IF;
  IF OLD.client_seed <> '' AND NEW.client_seed IS DISTINCT FROM OLD.client_seed THEN
    RAISE EXCEPTION 'race % client seed is locked', OLD.id;
  END IF;
  IF OLD.status <> 'ready' AND (NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.name IS DISTINCT FROM OLD.name) THEN
    RAISE EXCEPTION 'race % is locked after start', OLD.id;
  END IF;
  IF OLD.status = 'finished' AND NEW.status <> 'finished' THEN
    RAISE EXCEPTION 'race % is already finished', OLD.id;
  END IF;
  IF OLD.status = 'racing' AND NEW.status = 'ready' THEN
    RAISE EXCEPTION 'race % already started', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION dr_lock_participant() RETURNS trigger AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name OR NEW.race_id IS DISTINCT FROM OLD.race_id OR NEW.lane IS DISTINCT FROM OLD.lane THEN
    RAISE EXCEPTION 'participants of race % are locked', OLD.race_id;
  END IF;
  IF OLD.place <> 0 AND (NEW.place IS DISTINCT FROM OLD.place OR NEW.finish_ms IS DISTINCT FROM OLD.finish_ms) THEN
    RAISE EXCEPTION 'result of race % is locked', OLD.race_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS races_lock ON races;
CREATE TRIGGER races_lock BEFORE UPDATE ON races FOR EACH ROW EXECUTE FUNCTION dr_lock_race();
DROP TRIGGER IF EXISTS races_no_delete ON races;
CREATE TRIGGER races_no_delete BEFORE DELETE ON races FOR EACH ROW EXECUTE FUNCTION dr_forbid_change();

DROP TRIGGER IF EXISTS participants_lock ON race_participants;
CREATE TRIGGER participants_lock BEFORE UPDATE ON race_participants FOR EACH ROW EXECUTE FUNCTION dr_lock_participant();
DROP TRIGGER IF EXISTS participants_no_delete ON race_participants;
CREATE TRIGGER participants_no_delete BEFORE DELETE ON race_participants FOR EACH ROW EXECUTE FUNCTION dr_forbid_change();

DROP TRIGGER IF EXISTS audit_append_only ON audit_log;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION dr_forbid_change();

DROP TRIGGER IF EXISTS ledger_append_only ON ledger;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON ledger FOR EACH ROW EXECUTE FUNCTION dr_forbid_change();

DROP TRIGGER IF EXISTS payments_no_delete ON payments;
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments FOR EACH ROW EXECUTE FUNCTION dr_forbid_change();
