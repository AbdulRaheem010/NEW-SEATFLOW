-- SeatFlow — PostgreSQL schema
-- Run via `npm run migrate`, or paste into your Render Postgres console.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Keep SeatFlow isolated from other applications sharing the same database.
CREATE SCHEMA IF NOT EXISTS seatflow;
SET search_path TO seatflow, public;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'Other',
  date           DATE NOT NULL,
  start_time     TEXT,
  end_time       TEXT,
  venue          TEXT NOT NULL,
  description    TEXT,
  timezone       TEXT,
  logo_url       TEXT,
  theme          JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'draft', -- draft | live
  plan           TEXT NOT NULL DEFAULT 'free',  -- free | standard | extended
  show_tablemates   BOOLEAN NOT NULL DEFAULT true,
  anonymous_lookup  BOOLEAN NOT NULL DEFAULT false,
  qr_active      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tables (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  capacity   INTEGER NOT NULL DEFAULT 8,
  shape      TEXT NOT NULL DEFAULT 'round', -- round | rectangle | square
  x          INTEGER NOT NULL DEFAULT 0,
  y          INTEGER NOT NULL DEFAULT 0,
  width      INTEGER NOT NULL DEFAULT 120,
  height     INTEGER NOT NULL DEFAULT 120,
  rotation   INTEGER NOT NULL DEFAULT 0,
  locked     BOOLEAN NOT NULL DEFAULT false,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  "group"     TEXT,
  vip         BOOLEAN NOT NULL DEFAULT false,
  meal        TEXT,
  table_id    UUID REFERENCES tables(id) ON DELETE SET NULL,
  seat_number INTEGER,
  checked_in  BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner_id);
CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(event_id, lower(first_name), lower(last_name));
CREATE INDEX IF NOT EXISTS idx_tables_event ON tables(event_id);
