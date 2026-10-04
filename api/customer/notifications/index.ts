import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCustomer } from '../../../src/server/auth/customer.js'
import { getDb } from '../../../src/server/db/client.js'

const MAX_NOTIFICATIONS = 200

function normalizeType(value: unknown): string {
  const type = String(value ?? '').trim().toLowerCase()

  if (
    type === 'transaction' ||
    type === 'transfer' ||
    type === 'security' ||
    type === 'account'
  ) {
    return type
  }

  return 'account'
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method === 'GET') {
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
          SELECT
            id,
            title,
            message,
            notification_type,
            is_read,
            created_at
          FROM notifications
          WHERE customer_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        `,
        [customer.id, MAX_NOTIFICATIONS],
      )

      const unreadResult = await db.query(
        `
          SELECT COUNT(*) AS count
          FROM notifications
          WHERE customer_id = $1
            AND is_read = FALSE
        `,
        [customer.id],
      )

      return res.status(200).json({
        ok: true,
        notifications: result.rows.map((notification) => ({
          id: notification.id,
          type: normalizeType(notification.notification_type),
          title: notification.title,
          message: notification.message,
          createdAt: notification.created_at,
          unread: notification.is_read === false,
        })),
        unreadCount: Number(unreadResult.rows[0]?.count ?? 0),
      })
    } catch (error) {
      console.error('Customer notifications lookup failed:', error)

      return res.status(500).json({
        ok: false,
        error: 'Unable to load notifications.',
      })
    }
  }

  res.setHeader('Allow', 'GET')

  return res.status(405).json({
    ok: false,
    error: 'Method not allowed',
  })
}
