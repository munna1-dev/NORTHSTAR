PRAGMA foreign_keys = ON;

-- ============================================================
-- ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL
    CHECK (account_type IN ('checking', 'savings', 'business', 'credit')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'frozen', 'closed')),
  currency TEXT NOT NULL DEFAULT 'USD',
  available_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer
  ON accounts(customer_id);

CREATE INDEX IF NOT EXISTS idx_accounts_status
  ON accounts(status);

-- ============================================================
-- TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL
    REFERENCES accounts(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL
    CHECK (
      transaction_type IN (
        'deposit',
        'withdrawal',
        'transfer',
        'payment',
        'fee',
        'interest',
        'adjustment'
      )
    ),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (
      status IN (
        'pending',
        'completed',
        'failed',
        'reversed'
      )
    ),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  related_transaction_id TEXT
    REFERENCES transactions(id) ON DELETE SET NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_account
  ON transactions(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_reference
  ON transactions(reference);

CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions(status);

-- ============================================================
-- BENEFICIARIES
-- ============================================================

CREATE TABLE IF NOT EXISTS beneficiaries (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT,
  routing_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beneficiaries_customer
  ON beneficiaries(customer_id);

-- ============================================================
-- TRANSFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  from_account_id TEXT NOT NULL
    REFERENCES accounts(id),
  to_account_id TEXT
    REFERENCES accounts(id),
  beneficiary_id TEXT
    REFERENCES beneficiaries(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'completed',
        'failed',
        'cancelled'
      )
    ),
  reference TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfers_customer
  ON transfers(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_from_account
  ON transfers(from_account_id);

CREATE INDEX IF NOT EXISTS idx_transfers_status
  ON transfers(status);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL
    REFERENCES accounts(id),
  payee_name TEXT NOT NULL,
  payee_reference TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'completed',
        'failed',
        'cancelled'
      )
    ),
  reference TEXT NOT NULL UNIQUE,
  scheduled_for TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_customer
  ON payments(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_account
  ON payments(account_id);

-- ============================================================
-- CARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  account_id TEXT
    REFERENCES accounts(id) ON DELETE SET NULL,
  card_type TEXT NOT NULL DEFAULT 'debit',
  last_four TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'locked',
        'expired',
        'cancelled',
        'pending'
      )
    ),
  expiry_month INTEGER,
  expiry_year INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cards_customer
  ON cards(customer_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'general',
  is_read INTEGER NOT NULL DEFAULT 0
    CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_customer
  ON notifications(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(customer_id, is_read);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (
      status IN (
        'open',
        'in_progress',
        'waiting_customer',
        'resolved',
        'closed'
      )
    ),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer
  ON support_tickets(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status);

-- ============================================================
-- ACCOUNT APPLICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS account_applications (
  id TEXT PRIMARY KEY,
  customer_id TEXT
    REFERENCES customers(id) ON DELETE SET NULL,
  account_type TEXT NOT NULL
    CHECK (
      account_type IN (
        'checking',
        'savings',
        'business',
        'credit'
      )
    ),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'under_review',
        'approved',
        'rejected',
        'cancelled'
      )
    ),
  review_notes TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_account_applications_status
  ON account_applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_applications_customer
  ON account_applications(customer_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_customer_id TEXT
    REFERENCES customers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs(actor_customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER IF NOT EXISTS customers_updated_at
AFTER UPDATE ON customers
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE customers
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS accounts_updated_at
AFTER UPDATE ON accounts
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE accounts
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS beneficiaries_updated_at
AFTER UPDATE ON beneficiaries
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE beneficiaries
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS cards_updated_at
AFTER UPDATE ON cards
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE cards
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS support_tickets_updated_at
AFTER UPDATE ON support_tickets
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE support_tickets
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS account_applications_updated_at
AFTER UPDATE ON account_applications
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE account_applications
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS customer_preferences_updated_at
AFTER UPDATE ON customer_preferences
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE customer_preferences
  SET updated_at = CURRENT_TIMESTAMP
  WHERE customer_id = NEW.customer_id;
END;
