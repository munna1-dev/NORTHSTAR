
-- ============================================================
-- NORTHSTARBANK — U.S. BANKING INSTITUTION CONFIGURATION
-- ============================================================
-- Routing numbers are institution-level identifiers.
-- Never generate or fabricate a production ABA routing number.
-- A legitimate routing number can be configured later.
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  bank_name TEXT NOT NULL DEFAULT 'NorthStarBank',
  legal_name TEXT,
  country_code TEXT NOT NULL DEFAULT 'US'
    CHECK (country_code = 'US'),

  default_currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (default_currency = 'USD'),

  ach_routing_number TEXT,
  wire_routing_number TEXT,

  routing_status TEXT NOT NULL DEFAULT 'unconfigured'
    CHECK (
      routing_status IN (
        'unconfigured',
        'configured',
        'verified',
        'suspended'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Only one institution configuration is permitted.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_settings_singleton
  ON bank_settings ((TRUE));

-- U.S. ABA routing numbers are exactly 9 numeric digits.
ALTER TABLE bank_settings
  DROP CONSTRAINT IF EXISTS chk_bank_settings_ach_routing;

ALTER TABLE bank_settings
  ADD CONSTRAINT chk_bank_settings_ach_routing
  CHECK (
    ach_routing_number IS NULL
    OR ach_routing_number ~ '^[0-9]{9}$'
  );

ALTER TABLE bank_settings
  DROP CONSTRAINT IF EXISTS chk_bank_settings_wire_routing;

ALTER TABLE bank_settings
  ADD CONSTRAINT chk_bank_settings_wire_routing
  CHECK (
    wire_routing_number IS NULL
    OR wire_routing_number ~ '^[0-9]{9}$'
  );

-- Ensure the configured routing state is consistent.
ALTER TABLE bank_settings
  DROP CONSTRAINT IF EXISTS chk_bank_settings_routing_state;

ALTER TABLE bank_settings
  ADD CONSTRAINT chk_bank_settings_routing_state
  CHECK (
    routing_status = 'unconfigured'
    OR (
      ach_routing_number IS NOT NULL
      OR wire_routing_number IS NOT NULL
    )
  );

-- Reuse the project's existing timestamp trigger function.
DROP TRIGGER IF EXISTS trg_bank_settings_updated_at
  ON bank_settings;

CREATE TRIGGER trg_bank_settings_updated_at
BEFORE UPDATE ON bank_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Seed exactly one institution configuration.
INSERT INTO bank_settings (
  bank_name,
  legal_name,
  country_code,
  default_currency,
  routing_status
)
SELECT
  'NorthStarBank',
  'NorthStarBank',
  'US',
  'USD',
  'unconfigured'
WHERE NOT EXISTS (
  SELECT 1 FROM bank_settings
);
