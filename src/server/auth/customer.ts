import type { VercelRequest } from '@vercel/node'
import { getCustomerFromSession } from './session.js'

export interface AuthenticatedCustomer {
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

export async function requireCustomer(
  request: VercelRequest,
): Promise<AuthenticatedCustomer | null> {
  const customer = await getCustomerFromSession(request)

  if (!customer) {
    return null
  }

  return customer as unknown as AuthenticatedCustomer
}

export function customerResponse(customer: AuthenticatedCustomer) {
  return {
    id: customer.id,
    customerNumber: customer.customer_number,
    firstName: customer.first_name,
    lastName: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
    role: customer.role,
    twoFactorEnabled: customer.two_factor_enabled,
  }
}
