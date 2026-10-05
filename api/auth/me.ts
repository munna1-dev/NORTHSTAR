import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getCustomerFromSession } from '../../src/server/auth/session.js'
import {
  getEffectiveManagementPermissions,
  getManagementUser,
} from '../../src/server/auth/management.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    })
  }

  try {
    const customer = await getCustomerFromSession(req)

    if (!customer) {
      return res.status(401).json({
        ok: false,
        authenticated: false,
        error: 'Not authenticated.',
      })
    }

    let management: {
      staffId: string | null
      staffStatus: string | null
      department: string | null
      permissions: string[]
    } | null = null

    if (
      customer.role === 'staff' ||
      customer.role === 'management' ||
      customer.role === 'developer' ||
      customer.role === 'super_manager'
    ) {
      const managementUser = await getManagementUser(req)

      if (managementUser) {
        management = {
          staffId: managementUser.staff_id,
          staffStatus: managementUser.staff_status,
          department: managementUser.department,
          permissions:
            await getEffectiveManagementPermissions(managementUser),
        }
      }
    }

    return res.status(200).json({
      ok: true,
      authenticated: true,
      customer: {
        id: customer.id,
        customerNumber: customer.customer_number,
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        role: customer.role,
        twoFactorEnabled: customer.two_factor_enabled,
        ...(management
          ? {
              staffId: management.staffId,
              staffStatus: management.staffStatus,
              department: management.department,
              permissions: management.permissions,
            }
          : {}),
      },
    })
  } catch (error) {
    console.error('Session lookup failed:', error)

    return res.status(500).json({
      ok: false,
      authenticated: false,
      error: 'Unable to verify the session.',
    })
  }
}
