-- NorthStarBank authentication/security hardening.
-- PostgreSQL. Additive only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_created
  ON auth_login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_created
  ON auth_login_attempts(ip_address, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  challenge_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_mfa_challenges_customer
  ON auth_mfa_challenges(customer_id, created_at DESC);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER
  NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_customers_login_locked_until
  ON customers(login_locked_until);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_expires
  ON customer_sessions(customer_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_customer_security_events_created
  ON customer_security_events(created_at DESC);
