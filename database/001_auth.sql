PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  customer_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'suspended', 'closed')),
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'management', 'developer')),
  two_factor_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (two_factor_enabled IN (0, 1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer
  ON customer_sessions(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires
  ON customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS customer_preferences (
  customer_id TEXT PRIMARY KEY
    REFERENCES customers(id) ON DELETE CASCADE,
  email_alerts INTEGER NOT NULL DEFAULT 1
    CHECK (email_alerts IN (0, 1)),
  transaction_alerts INTEGER NOT NULL DEFAULT 1
    CHECK (transaction_alerts IN (0, 1)),
  security_alerts INTEGER NOT NULL DEFAULT 1
    CHECK (security_alerts IN (0, 1)),
  marketing_emails INTEGER NOT NULL DEFAULT 0
    CHECK (marketing_emails IN (0, 1)),
  product_updates INTEGER NOT NULL DEFAULT 1
    CHECK (product_updates IN (0, 1)),
  language TEXT NOT NULL DEFAULT 'English',
  currency TEXT NOT NULL DEFAULT 'USD',
  compact_transactions INTEGER NOT NULL DEFAULT 0
    CHECK (compact_transactions IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_security_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_security_events_customer
  ON customer_security_events(customer_id, created_at DESC);
