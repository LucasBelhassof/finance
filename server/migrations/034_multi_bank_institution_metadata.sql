-- Migration: Support multiple Pluggy bank connections per user
-- and store institution branding (name + logo) for identification.

-- 1. Drop the old UNIQUE(user_id) constraint so one user can connect N banks.
ALTER TABLE pluggy_connections DROP CONSTRAINT IF EXISTS pluggy_connections_user_id_key;

-- 2. Add UNIQUE(user_id, pluggy_item_id) so each item is stored once per user.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pluggy_connections_user_item_unique'
  ) THEN
    ALTER TABLE pluggy_connections
      ADD CONSTRAINT pluggy_connections_user_item_unique UNIQUE (user_id, pluggy_item_id);
  END IF;
END $$;

-- 3. Institution branding on the connection row itself.
ALTER TABLE pluggy_connections ADD COLUMN IF NOT EXISTS institution_name      TEXT;
ALTER TABLE pluggy_connections ADD COLUMN IF NOT EXISTS institution_image_url TEXT;

-- 4. Denormalized branding on each bank_connection row (avoids join in listBanks).
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS institution_name      TEXT;
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS institution_image_url TEXT;
