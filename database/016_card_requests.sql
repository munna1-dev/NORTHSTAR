CREATE TABLE IF NOT EXISTS card_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,

  account_id UUID
    REFERENCES accounts(id) ON DELETE SET NULL,

  card_category VARCHAR(20) NOT NULL
    CHECK (card_category IN (
      'savings', 'checking', 'credit', 'business'
    )),

  card_format VARCHAR(20) NOT NULL DEFAULT 'physical'
    CHECK (card_format IN ('physical', 'virtual')),

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'approved', 'rejected',
      'issued', 'cancelled'
    )),

  customer_notes TEXT,
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  issued_card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_card_requests_customer
  ON card_requests(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_requests_status
  ON card_requests(status, created_at DESC);
