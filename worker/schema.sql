-- LISAP D1 schema. Apply with: npx wrangler d1 execute lisap --remote --file worker/schema.sql

CREATE TABLE IF NOT EXISTS users (
  email            TEXT PRIMARY KEY,
  uid              TEXT,
  plus_tag         TEXT UNIQUE,          -- lisap.code+<plus_tag>@gmail.com (the Firebase UID)
  phone            TEXT,
  phones           TEXT NOT NULL DEFAULT '[]',
  active           INTEGER NOT NULL DEFAULT 0,
  connected_to     TEXT,                 -- owner's plus_tag, for friends who joined by invite
  fwd_code         TEXT,                 -- Gmail forwarding confirmation code
  fwd_link         TEXT,
  fwd_requested_by TEXT,
  fwd_received_at  INTEGER,
  updated_at       INTEGER
);

-- Email addresses allowed to create a new owner account (sign-up is invite-only)
CREATE TABLE IF NOT EXISTS invites (
  email      TEXT PRIMARY KEY,
  created_at INTEGER
);

-- Friends who receive an owner's codes
CREATE TABLE IF NOT EXISTS members (
  owner_email  TEXT NOT NULL,
  member_email TEXT NOT NULL,
  PRIMARY KEY (owner_email, member_email)
);

-- Firebase Cloud Messaging device tokens
CREATE TABLE IF NOT EXISTS devices (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS devices_email ON devices (email);

-- Gmail message ids already handled (kept 7 days)
CREATE TABLE IF NOT EXISTS processed (
  message_id TEXT PRIMARY KEY,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS processed_at ON processed (at);

-- gmail_history_id, gmail_watch_expiration
CREATE TABLE IF NOT EXISTS state (
  key   TEXT PRIMARY KEY,
  value TEXT
);
