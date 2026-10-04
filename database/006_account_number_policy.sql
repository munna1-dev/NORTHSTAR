-- ============================================================
-- NORTHSTARBANK — ACCOUNT NUMBER POLICY
-- ============================================================
-- NorthStarBank uses a 12-digit internal account-number format.
-- This is an institution-specific format, not a universal U.S.
-- banking standard.
--
-- ABA routing numbers remain institution-level and are configured
-- separately in bank_settings.
-- ============================================================

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS chk_accounts_account_number_format;

ALTER TABLE accounts
  ADD CONSTRAINT chk_accounts_account_number_format
  CHECK (
    account_number ~ '^[0-9]{12}$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_account_number_unique
  ON accounts (account_number);

COMMENT ON COLUMN accounts.account_number IS
  'NorthStarBank institution-specific 12-digit account number.';

COMMENT ON COLUMN accounts.currency IS
  'Account currency. NorthStarBank U.S. configuration defaults to USD.';
