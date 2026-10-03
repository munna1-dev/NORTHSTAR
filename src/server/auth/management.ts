import type { VercelRequest } from '@vercel/node'
import { getCustomerFromSession } from './session'

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
}

export async function requireManagement(
  request: VercelRequest,
): Promise<ManagementUser | null> {
  const customer = await getCustomerFromSession(request)

  if (!customer) {
    return null
  }

  if (
    customer.status !== 'active' ||
    (customer.role !== 'management' && customer.role !== 'developer')
  ) {
    return null
  }

  return customer as unknown as ManagementUser
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
  }
}
