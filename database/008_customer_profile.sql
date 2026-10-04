CREATE TABLE IF NOT EXISTS customer_profiles (
  customer_id UUID PRIMARY KEY
    REFERENCES customers(id) ON DELETE CASCADE,

  date_of_birth DATE NOT NULL,

  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state_code TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',

  kyc_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'verified', 'rejected')),

  kyc_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_kyc_status
  ON customer_profiles(kyc_status);

DROP TRIGGER IF EXISTS trg_customer_profiles_updated_at
ON customer_profiles;

CREATE TRIGGER trg_customer_profiles_updated_at
BEFORE UPDATE ON customer_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
