import type { VercelRequest } from '@vercel/node'
import { getCustomerFromSession } from './session'
import { getDb } from '../db/client'

export type ManagementPermission =
  | 'customers.view'
  | 'customers.review'
  | 'customers.approve'
  | 'customers.suspend'
  | 'customers.block'
  | 'customers.reactivate'
  | 'customers.close'
  | 'staff.view'
  | 'staff.approve'
  | 'staff.reject'
  | 'staff.suspend'
  | 'staff.block'
  | 'staff.reactivate'
  | 'staff.terminate'
  | 'staff.roles'
  | 'staff.permissions'
  | 'applications.view'
  | 'applications.approve'
  | 'applications.reject'
  | 'applications.kyc'
  | 'accounts.view'
  | 'accounts.activate'
  | 'accounts.freeze'
  | 'accounts.close'
  | 'transactions.view'
  | 'transfers.view'
  | 'transfers.approve'
  | 'transfers.reject'
  | 'payments.view'
  | 'payments.approve'
  | 'payments.reject'
  | 'cards.view'
  | 'cards.manage'
  | 'support.view'
  | 'support.manage'
  | 'reports.view'
  | 'audit.view'
  | 'security.view'
  | 'system.settings'

export interface ManagementUser {
  id: string
  customer_number: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  role: string
  two_factor_enabled: boolean
  staff_status: string | null
  department: string | null
}

export async function getManagementUser(
  request: VercelRequest,
): Promise<ManagementUser | null> {
  const customer = await getCustomerFromSession(request)

  if (!customer) return null

  if (
    customer.status !== 'active' ||
    !['management', 'developer', 'super_manager'].includes(customer.role)
  ) {
    return null
  }

  const db = getDb()

  const result = await db.query(
    `
      SELECT
        c.id,
        c.customer_number,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.status,
        c.role,
        c.two_factor_enabled,
        c.staff_status,
        c.department
      FROM customers c
      WHERE c.id = $1
        AND c.status = 'active'
      LIMIT 1
    `,
    [customer.id],
  )

  if (result.rowCount !== 1) return null

  return result.rows[0] as ManagementUser
}

export async function requireManagement(
  request: VercelRequest,
): Promise<ManagementUser | null> {
  return getManagementUser(request)
}

export async function hasManagementPermission(
  user: ManagementUser,
  permission: ManagementPermission,
): Promise<boolean> {
  if (user.role === 'super_manager') {
    return true
  }

  const db = getDb()

  const result = await db.query(
    `
      WITH role_permissions AS (
        SELECT p.permission_key
        FROM staff_role_assignments sra
        JOIN management_roles r
          ON r.id = sra.role_id
        JOIN management_role_permissions rp
          ON rp.role_id = r.id
        JOIN management_permissions p
          ON p.id = rp.permission_id
        WHERE sra.customer_id = $1
          AND r.is_active = TRUE
      ),
      overrides AS (
        SELECT
          p.permission_key,
          spa.effect
        FROM staff_permission_assignments spa
        JOIN management_permissions p
          ON p.id = spa.permission_id
        WHERE spa.customer_id = $1
      )
      SELECT 1
      WHERE EXISTS (
        SELECT 1
        FROM overrides
        WHERE permission_key = $2
          AND effect = 'deny'
      ) IS NOT TRUE
      AND (
        EXISTS (
          SELECT 1
          FROM overrides
          WHERE permission_key = $2
            AND effect = 'allow'
        )
        OR EXISTS (
          SELECT 1
          FROM role_permissions
          WHERE permission_key = $2
        )
      )
      LIMIT 1
    `,
    [user.id, permission],
  )

  return result.rowCount === 1
}

export async function requirePermission(
  request: VercelRequest,
  permission: ManagementPermission,
): Promise<ManagementUser | null> {
  const user = await getManagementUser(request)

  if (!user) return null

  if (await hasManagementPermission(user, permission)) {
    return user
  }

  return null
}

export async function requireAnyPermission(
  request: VercelRequest,
  permissions: readonly ManagementPermission[],
): Promise<ManagementUser | null> {
  const user = await getManagementUser(request)

  if (!user) return null

  if (user.role === 'super_manager') {
    return user
  }

  for (const permission of permissions) {
    if (await hasManagementPermission(user, permission)) {
      return user
    }
  }

  return null
}

export function managementResponse(user: ManagementUser) {
  return {
    id: user.id,
    customerNumber: user.customer_number,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: user.role,
    twoFactorEnabled: user.two_factor_enabled,
    staffStatus: user.staff_status,
    department: user.department,
  }
}
