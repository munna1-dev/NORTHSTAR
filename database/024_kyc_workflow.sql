ALTER TABLE public.kyc_documents
  ADD COLUMN IF NOT EXISTS reviewed_by_staff_id UUID
  REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kyc_documents_customer_status
  ON public.kyc_documents(customer_id, document_status, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_staff_reviewer
  ON public.kyc_documents(reviewed_by_staff_id)
  WHERE reviewed_by_staff_id IS NOT NULL;

INSERT INTO public.management_permissions
  (permission_key, permission_name, permission_group, description)
VALUES
  ('kyc.view', 'View KYC documents', 'kyc', 'View KYC submissions and private documents.'),
  ('kyc.review', 'Review KYC documents', 'kyc', 'Approve or reject KYC submissions.')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO public.management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.management_roles r
CROSS JOIN public.management_permissions p
WHERE r.role_key IN ('super_manager', 'kyc_compliance')
  AND p.permission_key IN ('kyc.view', 'kyc.review')
ON CONFLICT DO NOTHING;
