ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS recurrence_ends_on DATE;
