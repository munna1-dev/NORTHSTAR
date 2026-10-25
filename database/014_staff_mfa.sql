ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS mfa_pending_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS mfa_pending_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.staff_mfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_mfa_challenges_staff
  ON public.staff_mfa_challenges(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_mfa_challenges_expiry
  ON public.staff_mfa_challenges(expires_at);
