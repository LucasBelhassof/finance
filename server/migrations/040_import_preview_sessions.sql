CREATE TABLE IF NOT EXISTS import_preview_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'transaction_import',
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_preview_sessions_user_expires_at
ON import_preview_sessions (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_preview_sessions_expires_at
ON import_preview_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_import_preview_sessions_committed_at
ON import_preview_sessions (committed_at);
