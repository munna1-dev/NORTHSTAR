-- NorthStarBank PostgreSQL baseline.
-- Combines the preserved PostgreSQL auth/core/financial schemas.
-- This is the foundation for migrations 004+.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- CUSTOMERS / AUTH
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_number VARCHAR(32) NOT NULL UNIQUE,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,

  email VARCHAR(320) NOT NULL UNIQUE,
  phone VARCHAR(40),

  password_hash TEXT NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'suspended', 'closed')),

  role VARCHAR(30) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'staff', 'management', 'developer', 'super_manager')),

  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  last_login_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_status
  ON customers(status);

CREATE INDEX IF NOT EXISTS idx_customers_role
  ON customers(role);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  token_hash TEXT NOT NULL UNIQUE,

  user_agent TEXT,
  ip_address INET,

  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer
  ON customer_sessions(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_expiry
  ON customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS customer_preferences (
  customer_id UUID PRIMARY KEY
    REFERENCES customers(id)
    ON DELETE CASCADE,

  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  transaction_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  security_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,
  product_updates BOOLEAN NOT NULL DEFAULT TRUE,

  language VARCHAR(50) NOT NULL DEFAULT 'English',
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',

  compact_transactions BOOLEAN NOT NULL DEFAULT FALSE,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  event_type VARCHAR(100) NOT NULL,

  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_security_events_customer
  ON customer_security_events(customer_id, created_at DESC);

-- ============================================================
-- CORE BANKING
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  account_number VARCHAR(32) NOT NULL UNIQUE,

  account_type VARCHAR(20) NOT NULL
    CHECK (account_type IN ('checking', 'savings', 'business', 'credit')),

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'frozen', 'closed')),

  currency VARCHAR(10) NOT NULL DEFAULT 'USD',

  available_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer
  ON accounts(customer_id);

CREATE INDEX IF NOT EXISTS idx_accounts_status
  ON accounts(status);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  account_id UUID NOT NULL
    REFERENCES accounts(id)
    ON DELETE CASCADE,

  reference VARCHAR(64) NOT NULL UNIQUE,

  transaction_type VARCHAR(30) NOT NULL
    CHECK (transaction_type IN (
      'deposit', 'withdrawal', 'transfer', 'payment',
      'fee', 'interest', 'adjustment'
    )),

  status VARCHAR(20) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),

  description VARCHAR(500) NOT NULL,

  amount NUMERIC(18,2) NOT NULL,

  currency VARCHAR(10) NOT NULL DEFAULT 'USD',

  related_transaction_id UUID
    REFERENCES transactions(id)
    ON DELETE SET NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_account
  ON transactions(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_reference
  ON transactions(reference);

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions(status);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  name VARCHAR(200) NOT NULL,
  account_number VARCHAR(64) NOT NULL,
  bank_name VARCHAR(200),
  routing_reference VARCHAR(100),

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'disabled')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beneficiaries_customer
  ON beneficiaries(customer_id);

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  from_account_id UUID NOT NULL REFERENCES accounts(id),
  to_account_id UUID REFERENCES accounts(id),
  beneficiary_id UUID REFERENCES beneficiaries(id),

  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',

  description VARCHAR(500),

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),

  reference VARCHAR(64) NOT NULL UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transfers_customer
  ON transfers(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_from_account
  ON transfers(from_account_id);

CREATE INDEX IF NOT EXISTS idx_transfers_status
  ON transfers(status);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  account_id UUID NOT NULL REFERENCES accounts(id),

  payee_name VARCHAR(200) NOT NULL,
  payee_reference VARCHAR(200),

  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',

  description VARCHAR(500),

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),

  reference VARCHAR(64) NOT NULL UNIQUE,

  scheduled_for DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_customer
  ON payments(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_account
  ON payments(account_id);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,

  card_type VARCHAR(30) NOT NULL DEFAULT 'debit',
  last_four VARCHAR(4) NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'active', 'locked', 'expired', 'cancelled', 'pending'
    )),

  expiry_month SMALLINT,
  expiry_year SMALLINT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cards_customer
  ON cards(customer_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,

  notification_type VARCHAR(50) NOT NULL DEFAULT 'general',

  is_read BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_customer
  ON notifications(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(customer_id, is_read);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id)
    ON DELETE CASCADE,

  subject VARCHAR(250) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,

  status VARCHAR(30) NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open', 'in_progress', 'waiting_customer',
      'resolved', 'closed'
    )),

  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  assigned_to UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer
  ON support_tickets(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status);

CREATE TABLE IF NOT EXISTS account_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  account_type VARCHAR(20) NOT NULL
    CHECK (account_type IN ('checking', 'savings', 'business', 'credit')),

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,

  email VARCHAR(320) NOT NULL,
  phone VARCHAR(40),

  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'under_review', 'approved', 'rejected', 'cancelled'
    )),

  review_notes TEXT,
  reviewed_by UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_applications_status
  ON account_applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_applications_customer
  ON account_applications(customer_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  actor_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  action VARCHAR(100) NOT NULL,

  resource_type VARCHAR(100),
  resource_id UUID,

  description TEXT,

  ip_address INET,
  user_agent TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs(actor_customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id);

-- ============================================================
-- UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS accounts_updated_at ON accounts;
CREATE TRIGGER accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS beneficiaries_updated_at ON beneficiaries;
CREATE TRIGGER beneficiaries_updated_at
BEFORE UPDATE ON beneficiaries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS cards_updated_at ON cards;
CREATE TRIGGER cards_updated_at
BEFORE UPDATE ON cards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS support_tickets_updated_at ON support_tickets;
CREATE TRIGGER support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS account_applications_updated_at ON account_applications;
CREATE TRIGGER account_applications_updated_at
BEFORE UPDATE ON account_applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS customer_preferences_updated_at ON customer_preferences;
CREATE TRIGGER customer_preferences_updated_at
BEFORE UPDATE ON customer_preferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
