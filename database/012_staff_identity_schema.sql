-- NorthStarBank: dedicated staff identity schema.
-- Additive only. Does not promote users or change credentials.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS staff_id_sequence
  START WITH 1 INCREMENT BY 1 CACHE 1;

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','active','suspended','blocked','terminated')),
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  employee_number TEXT,
  department TEXT,
  profile_image_url TEXT,
  profile_image_path TEXT,
  approved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  blocked_at TIMESTAMPTZ,
  block_reason TEXT,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (failed_login_attempts >= 0),
  login_locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_email_lower
  ON staff (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_employee_number
  ON staff (employee_number)
  WHERE employee_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS staff_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_staff
  ON staff_sessions (staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_expiry
  ON staff_sessions (expires_at);

CREATE TABLE IF NOT EXISTS staff_role_assignments_v2 (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES management_roles(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_role_assignments_v2_role
  ON staff_role_assignments_v2 (role_id);

CREATE TABLE IF NOT EXISTS staff_permission_assignments_v2 (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES management_permissions(id) ON DELETE RESTRICT,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  assigned_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_permission_assignments_v2_permission
  ON staff_permission_assignments_v2 (permission_id);

CREATE INDEX IF NOT EXISTS idx_staff_status
  ON staff (status);

CREATE TRIGGER trg_staff_updated_at
BEFORE UPDATE ON staff
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
