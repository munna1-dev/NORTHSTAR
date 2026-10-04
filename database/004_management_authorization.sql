-- NorthStarBank management authorization
-- Adds Super Manager authority, staff onboarding, roles and granular permissions.
-- Does NOT change passwords or create a replacement management account.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Extend customer roles
-- ============================================================

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_role_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_role_check
  CHECK (
    role IN (
      'customer',
      'staff',
      'management',
      'developer',
      'super_manager'
    )
  );

-- ============================================================
-- 2. Staff account/application status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'staff_application_status'
  ) THEN
    CREATE TYPE staff_application_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  employee_number TEXT,
  requested_department TEXT,
  requested_role TEXT,

  status staff_application_status NOT NULL DEFAULT 'pending',

  application_notes TEXT,
  review_notes TEXT,

  reviewed_by UUID REFERENCES customers(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_applications_status
  ON staff_applications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_applications_email
  ON staff_applications(lower(email));

-- ============================================================
-- 3. Staff operational status
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS staff_status TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS approved_by UUID;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS blocked_by UUID;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS block_reason TEXT;

ALTER TABLE customers
  ADD CONSTRAINT customers_staff_status_check
  CHECK (
    staff_status IS NULL
    OR staff_status IN (
      'pending',
      'active',
      'suspended',
      'blocked',
      'terminated'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_employee_number
  ON customers(employee_number)
  WHERE employee_number IS NOT NULL;

-- ============================================================
-- 4. Management roles
-- ============================================================

CREATE TABLE IF NOT EXISTS management_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  role_key TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  description TEXT,

  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO management_roles
  (role_key, role_name, description, is_system_role)
VALUES
  (
    'super_manager',
    'Super Manager',
    'Highest operational authority with responsibility for customers, staff, approvals, permissions and banking administration.',
    TRUE
  ),
  (
    'operations_manager',
    'Operations Manager',
    'Manages banking operations, accounts, transactions, transfers and payments.',
    TRUE
  ),
  (
    'customer_service',
    'Customer Service',
    'Manages customer service cases and permitted customer records.',
    TRUE
  ),
  (
    'kyc_compliance',
    'KYC & Compliance Officer',
    'Reviews onboarding applications and identity verification information.',
    TRUE
  ),
  (
    'finance_officer',
    'Finance Officer',
    'Handles permitted financial operations and reporting.',
    TRUE
  ),
  (
    'auditor',
    'Auditor',
    'Read-only access to permitted operational and audit records.',
    TRUE
  ),
  (
    'developer',
    'Developer',
    'Technical/system access subject to explicit developer permissions.',
    TRUE
  )
ON CONFLICT (role_key) DO NOTHING;

-- ============================================================
-- 5. Granular permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS management_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  permission_key TEXT NOT NULL UNIQUE,
  permission_name TEXT NOT NULL,
  permission_group TEXT NOT NULL,
  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO management_permissions
  (permission_key, permission_name, permission_group, description)
VALUES
  ('customers.view', 'View customers', 'customers', 'View customer records.'),
  ('customers.review', 'Review customers', 'customers', 'Review customer information and status.'),
  ('customers.approve', 'Approve customers', 'customers', 'Approve eligible customer onboarding.'),
  ('customers.suspend', 'Suspend customers', 'customers', 'Temporarily suspend customer access.'),
  ('customers.block', 'Block customers', 'customers', 'Block customer access.'),
  ('customers.reactivate', 'Reactivate customers', 'customers', 'Restore customer access.'),
  ('customers.close', 'Close customers', 'customers', 'Close eligible customer relationships.'),

  ('staff.view', 'View staff', 'staff', 'View staff records.'),
  ('staff.approve', 'Approve staff', 'staff', 'Approve staff registrations.'),
  ('staff.reject', 'Reject staff', 'staff', 'Reject staff registrations.'),
  ('staff.suspend', 'Suspend staff', 'staff', 'Suspend staff access.'),
  ('staff.block', 'Block staff', 'staff', 'Block staff access.'),
  ('staff.reactivate', 'Reactivate staff', 'staff', 'Restore staff access.'),
  ('staff.terminate', 'Terminate staff', 'staff', 'Terminate staff access.'),
  ('staff.roles', 'Manage staff roles', 'staff', 'Assign and remove staff roles.'),
  ('staff.permissions', 'Manage staff permissions', 'staff', 'Assign and remove granular staff permissions.'),

  ('applications.view', 'View applications', 'applications', 'View onboarding applications.'),
  ('applications.approve', 'Approve applications', 'applications', 'Approve account applications.'),
  ('applications.reject', 'Reject applications', 'applications', 'Reject account applications.'),
  ('applications.kyc', 'Review KYC', 'applications', 'Review identity and KYC information.'),

  ('accounts.view', 'View accounts', 'accounts', 'View customer accounts.'),
  ('accounts.activate', 'Activate accounts', 'accounts', 'Activate accounts.'),
  ('accounts.freeze', 'Freeze accounts', 'accounts', 'Freeze accounts.'),
  ('accounts.close', 'Close accounts', 'accounts', 'Close eligible accounts.'),

  ('transactions.view', 'View transactions', 'transactions', 'View transaction records.'),

  ('transfers.view', 'View transfers', 'operations', 'View transfer instructions.'),
  ('transfers.approve', 'Approve transfers', 'operations', 'Approve permitted transfers.'),
  ('transfers.reject', 'Reject transfers', 'operations', 'Reject permitted transfers.'),

  ('payments.view', 'View payments', 'operations', 'View payment instructions.'),
  ('payments.approve', 'Approve payments', 'operations', 'Approve permitted payments.'),
  ('payments.reject', 'Reject payments', 'operations', 'Reject permitted payments.'),

  ('cards.view', 'View cards', 'cards', 'View card records.'),
  ('cards.manage', 'Manage cards', 'cards', 'Manage permitted card status operations.'),

  ('support.view', 'View support', 'support', 'View customer support tickets.'),
  ('support.manage', 'Manage support', 'support', 'Manage customer support tickets.'),

  ('reports.view', 'View reports', 'reports', 'View operational reports.'),

  ('audit.view', 'View audit logs', 'security', 'View audit records.'),
  ('security.view', 'View security events', 'security', 'View security events.'),

  ('system.settings', 'Manage system settings', 'system', 'Manage permitted banking system settings.')
ON CONFLICT (permission_key) DO NOTHING;

-- ============================================================
-- 6. Role permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS management_role_permissions (
  role_id UUID NOT NULL REFERENCES management_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES management_permissions(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (role_id, permission_id)
);

-- Super Manager receives every currently defined permission.
INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
CROSS JOIN management_permissions p
WHERE r.role_key = 'super_manager'
ON CONFLICT DO NOTHING;

-- Operations Manager
INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
JOIN management_permissions p
  ON p.permission_key IN (
    'customers.view',
    'accounts.view',
    'accounts.activate',
    'accounts.freeze',
    'accounts.close',
    'transactions.view',
    'transfers.view',
    'transfers.approve',
    'transfers.reject',
    'payments.view',
    'payments.approve',
    'payments.reject',
    'cards.view',
    'cards.manage',
    'reports.view',
    'audit.view'
  )
WHERE r.role_key = 'operations_manager'
ON CONFLICT DO NOTHING;

-- Customer Service
INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
JOIN management_permissions p
  ON p.permission_key IN (
    'customers.view',
    'customers.review',
    'customers.suspend',
    'customers.reactivate',
    'support.view',
    'support.manage',
    'accounts.view',
    'transactions.view'
  )
WHERE r.role_key = 'customer_service'
ON CONFLICT DO NOTHING;

-- KYC / Compliance
INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
JOIN management_permissions p
  ON p.permission_key IN (
    'customers.view',
    'customers.review',
    'applications.view',
    'applications.approve',
    'applications.reject',
    'applications.kyc',
    'security.view',
    'audit.view',
    'reports.view'
  )
WHERE r.role_key = 'kyc_compliance'
ON CONFLICT DO NOTHING;

-- Finance Officer
INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
JOIN management_permissions p
  ON p.permission_key IN (
    'accounts.view',
    'transactions.view',
    'transfers.view',
    'transfers.approve',
    'transfers.reject',
    'payments.view',
    'payments.approve',
    'payments.reject',
    'reports.view',
    'audit.view'
  )
WHERE r.role_key = 'finance_officer'
ON CONFLICT DO NOTHING;

-- Auditor
INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
JOIN management_permissions p
  ON p.permission_key IN (
    'customers.view',
    'accounts.view',
    'transactions.view',
    'transfers.view',
    'payments.view',
    'applications.view',
    'support.view',
    'reports.view',
    'audit.view',
    'security.view'
  )
WHERE r.role_key = 'auditor'
ON CONFLICT DO NOTHING;

-- Developer
INSERT INTO management_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM management_roles r
JOIN management_permissions p
  ON p.permission_key IN (
    'audit.view',
    'security.view',
    'system.settings'
  )
WHERE r.role_key = 'developer'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. Staff role assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_role_assignments (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES management_roles(id) ON DELETE RESTRICT,

  assigned_by UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (customer_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_role_assignments_customer
  ON staff_role_assignments(customer_id);

-- ============================================================
-- 8. Individual permission overrides
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_permission_assignments (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES management_permissions(id) ON DELETE RESTRICT,

  effect TEXT NOT NULL
    CHECK (effect IN ('allow', 'deny')),

  assigned_by UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (customer_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_permission_assignments_customer
  ON staff_permission_assignments(customer_id);

-- ============================================================
-- 9. Promote the existing management account
-- ============================================================

UPDATE customers
SET
  role = 'super_manager',
  staff_status = 'active',
  department = COALESCE(department, 'Executive Management'),
  approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP),
  updated_at = CURRENT_TIMESTAMP
WHERE lower(email) = lower('support@northstarbank.site');

-- Protect against accidental removal of the Super Manager role
-- by ordinary management workflows. Application code will enforce
-- the actor-level authorization as well.
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_super_manager
  ON customers(role)
  WHERE role = 'super_manager';

-- ============================================================
-- 10. Assign the Super Manager role explicitly
-- ============================================================

INSERT INTO staff_role_assignments (
  customer_id,
  role_id,
  assigned_by
)
SELECT
  c.id,
  r.id,
  c.id
FROM customers c
JOIN management_roles r
  ON r.role_key = 'super_manager'
WHERE lower(c.email) = lower('support@northstarbank.site')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 11. Updated-at trigger
-- ============================================================

DROP TRIGGER IF EXISTS trg_staff_applications_updated_at
ON staff_applications;

CREATE TRIGGER trg_staff_applications_updated_at
BEFORE UPDATE ON staff_applications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_management_roles_updated_at
ON management_roles;

CREATE TRIGGER trg_management_roles_updated_at
BEFORE UPDATE ON management_roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
