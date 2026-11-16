-- Keep legacy reviewed_by values intact.
-- New staff reviews use the actual staff identity.

ALTER TABLE public.staff_applications
  ADD COLUMN IF NOT EXISTS reviewed_by_staff_id UUID
    REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS
  idx_staff_applications_reviewed_by_staff
ON public.staff_applications (reviewed_by_staff_id)
WHERE reviewed_by_staff_id IS NOT NULL;
