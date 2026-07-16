-- Token counters (daily SQLite sequences) + idempotency keys for write APIs

CREATE TABLE IF NOT EXISTS token_counters (
  location_id TEXT NOT NULL,
  counter_key TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (location_id, counter_key)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (location_id, key, method, path)
);
