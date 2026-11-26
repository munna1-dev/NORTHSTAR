-- NorthStarBank financial schema reconciliation.
-- Additive and safe for existing account records.

CREATE TABLE IF NOT EXISTS public.financial_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL
    REFERENCES public.customers(id) ON DELETE CASCADE,
  account_id UUID NOT NULL
    REFERENCES public.accounts(id) ON DELETE RESTRICT,
  request_type TEXT NOT NULL
    CHECK (request_type IN ('deposit','withdrawal')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','completed','cancelled')),
  reference TEXT NOT NULL UNIQUE,
  idempotency_key UUID NOT NULL,
  description TEXT,
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT financial_requests_customer_idempotency_unique
    UNIQUE (customer_id, idempotency_key)
);

ALTER TABLE public.financial_requests
  ADD COLUMN IF NOT EXISTS deposit_method TEXT,
  ADD COLUMN IF NOT EXISTS deposit_reference TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_name TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_bank TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_account_number TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_routing_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_note TEXT,
  ADD COLUMN IF NOT EXISTS settlement_reference TEXT,
  ADD COLUMN IF NOT EXISTS completed_by UUID
    REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID
    REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
    NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS withdrawals_blocked BOOLEAN
    NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS withdrawal_limit NUMERIC(18,2);

CREATE INDEX IF NOT EXISTS financial_requests_customer_created
  ON public.financial_requests(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS financial_requests_type_status_created
  ON public.financial_requests(request_type, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS financial_requests_customer_idempotency_idx
  ON public.financial_requests(customer_id, idempotency_key);

CREATE INDEX IF NOT EXISTS accounts_withdrawal_controls_idx
  ON public.accounts(id)
  WHERE withdrawals_blocked = TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_withdrawal_limit_nonnegative'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_withdrawal_limit_nonnegative
      CHECK (withdrawal_limit IS NULL OR withdrawal_limit >= 0);
  END IF;
END $$;
