import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  customerResponse,
  requireCustomer,
} from '../../src/server/auth/customer'

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
    const customer = await requireCustomer(req)

    if (!customer) {
      return res.status(401).json({
        ok: false,
        authenticated: false,
        error: 'Not authenticated.',
      })
    }

    return res.status(200).json({
      ok: true,
      customer: customerResponse(customer),
    })
  } catch (error) {
    console.error('Customer profile lookup failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to load customer profile.',
    })
  }
}
