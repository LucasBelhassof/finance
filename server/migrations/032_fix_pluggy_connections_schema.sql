-- Migration: Fix pluggy_connections schema.
-- The table was originally created with an access_token NOT NULL column from
-- a legacy OAuth flow. The current widget flow uses app-level credentials only
-- (CLIENT_ID + CLIENT_SECRET), so no per-user access token is stored or needed.

-- Ensure the base columns exist (idempotent, for fresh installs that skipped the old schema)
ALTER TABLE pluggy_connections
  ADD COLUMN IF NOT EXISTS pluggy_item_id TEXT;

ALTER TABLE pluggy_connections
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

ALTER TABLE pluggy_connections
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Remove the legacy access_token column if it exists
ALTER TABLE pluggy_connections
  DROP COLUMN IF EXISTS access_token;

-- Remove other legacy OAuth columns if they exist
ALTER TABLE pluggy_connections
  DROP COLUMN IF EXISTS refresh_token;

ALTER TABLE pluggy_connections
  DROP COLUMN IF EXISTS token_expires_at;
