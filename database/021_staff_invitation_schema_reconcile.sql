ALTER TABLE public.staff_applications
  ADD COLUMN IF NOT EXISTS generated_staff_email TEXT,
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invitation_status TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invitation_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invitation_last_error TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.staff_invitation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.staff_applications(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_applications_generated_email_unique
  ON public.staff_applications (LOWER(generated_staff_email))
  WHERE generated_staff_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_applications_staff_id
  ON public.staff_applications (staff_id)
  WHERE staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_applications_reviewed_by_staff
  ON public.staff_applications (reviewed_by_staff_id)
  WHERE reviewed_by_staff_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_invitation_one_unused_token_per_staff
  ON public.staff_invitation_tokens (staff_id)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_invitation_tokens_expiry
  ON public.staff_invitation_tokens (expires_at);

