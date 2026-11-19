ALTER TABLE public.financial_requests
  ADD COLUMN IF NOT EXISTS deposit_method text,
  ADD COLUMN IF NOT EXISTS deposit_reference text,
  ADD COLUMN IF NOT EXISTS beneficiary_name text,
  ADD COLUMN IF NOT EXISTS beneficiary_bank text,
  ADD COLUMN IF NOT EXISTS beneficiary_account_number text,
  ADD COLUMN IF NOT EXISTS beneficiary_routing_code text,
  ADD COLUMN IF NOT EXISTS customer_note text,
  ADD COLUMN IF NOT EXISTS settlement_reference text,
  ADD COLUMN IF NOT EXISTS completed_by uuid
    REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS financial_requests_customer_created
  ON public.financial_requests (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS financial_requests_type_status_created
  ON public.financial_requests (request_type, status, created_at DESC);
