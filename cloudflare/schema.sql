CREATE TABLE IF NOT EXISTS records (
  sync_key_hash TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  PRIMARY KEY (sync_key_hash, record_id)
);

CREATE INDEX IF NOT EXISTS idx_records_sync_key_hash
  ON records(sync_key_hash);

