CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NULL REFERENCES customers(id) ON DELETE CASCADE,
  application_id UUID NULL REFERENCES account_applications(id) ON DELETE CASCADE,

  document_type TEXT NOT NULL
    CHECK (document_type IN (
      'passport',
      'drivers_license',
      'national_id',
      'residence_permit'
    )),

  document_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (document_status IN (
      'pending',
      'approved',
      'rejected'
    )),

  storage_provider TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL
    CHECK (file_size_bytes > 0),
  document_last4 TEXT NULL,

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL REFERENCES customers(id),
  review_notes TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_documents_owner_check
    CHECK (customer_id IS NOT NULL OR application_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_customer
  ON kyc_documents(customer_id);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_application
  ON kyc_documents(application_id);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_status
  ON kyc_documents(document_status);

DROP TRIGGER IF EXISTS kyc_documents_updated_at ON kyc_documents;

CREATE TRIGGER kyc_documents_updated_at
BEFORE UPDATE ON kyc_documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE kyc_documents IS
  'Private KYC document metadata. Actual identity files must never be stored under public/.';

COMMENT ON COLUMN kyc_documents.storage_path IS
  'Private storage reference. Never expose as a public static URL.';
