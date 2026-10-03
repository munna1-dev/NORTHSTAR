import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCustomer } from '../../../src/server/auth/customer'
import { getDb } from '../../../src/server/db/client'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')

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

    const db = getDb()

    const result = await db.query(
      `
        UPDATE notifications
        SET is_read = TRUE
        WHERE customer_id = $1
          AND is_read = FALSE
      `,
      [customer.id],
    )

    return res.status(200).json({
      ok: true,
      changed: result.rowCount ?? 0,
    })
  } catch (error) {
    console.error('Mark all customer notifications read failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to mark notifications as read.',
    })
  }
}
