-- NorthStarBank staff identity and self-service authorization
-- Additive migration.
-- Does NOT change passwords or replace existing Super Manager credentials.

-- ============================================================
-- 1. Dedicated Staff ID
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS staff_id_sequence
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS staff_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_staff_id
  ON customers(staff_id)
  WHERE staff_id IS NOT NULL;

-- Initialize the sequence after any existing STF-XXXXXX values.
SELECT setval(
  'staff_id_sequence',
  COALESCE(
    (
      SELECT MAX(
        CASE
          WHEN staff_id ~ '^STF-[0-9]+$'
          THEN CAST(SUBSTRING(staff_id FROM '^STF-([0-9]+)$') AS BIGINT)
        END
      )
      FROM customers
    ),
    1
  ),
  EXISTS (
    SELECT 1
    FROM customers
    WHERE staff_id ~ '^STF-[0-9]+$'
  )
);

-- ============================================================
-- 2. Staff self-service permissions
-- ============================================================

INSERT INTO management_permissions
  (permission_key, permission_name, permission_group, description)
VALUES
  (
    'dashboard.view',
    'View dashboard',
    'dashboard',
    'View the management dashboard.'
  ),
  (
    'profile.view',
    'View own profile',
    'profile',
    'View the signed-in staff member''s own profile.'
  ),
  (
    'profile.update',
    'Update own profile',
    'profile',
    'Update permitted fields on the signed-in staff member''s own profile.'
  )
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- 3. Existing management roles receive dashboard visibility
-- ============================================================

INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
CROSS JOIN management_permissions p
WHERE p.permission_key = 'dashboard.view'
  AND r.role_key IN (
    'super_manager',
    'operations_manager',
    'customer_service',
    'kyc_compliance',
    'finance_officer',
    'auditor',
    'developer'
  )
ON CONFLICT DO NOTHING;
