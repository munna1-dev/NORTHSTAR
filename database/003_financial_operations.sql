-- ============================================================
-- FINANCIAL OPERATION SAFETY
-- ============================================================

ALTER TABLE transfers
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_idempotency
  ON transfers(customer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE payments
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency
  ON payments(customer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
