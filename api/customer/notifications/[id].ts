import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireCustomer } from '../../../src/server/auth/customer'
import { getDb } from '../../../src/server/db/client'

const updateNotificationSchema = z.object({
  isRead: z.boolean(),
})

function getId(req: VercelRequest): string | null {
  const value = req.query.id

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return typeof value === 'string' ? value : null
}

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

  const id = getId(req)

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: 'Notification ID is required.',
    })
  }

  const parsed = updateNotificationSchema.safeParse(req.body ?? {})

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: 'A valid read state is required.',
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
        SET is_read = $1
        WHERE id = $2
          AND customer_id = $3
        RETURNING
          id,
          title,
          message,
          notification_type,
          is_read,
          created_at
      `,
      [parsed.data.isRead, id, customer.id],
    )

    if (result.rowCount !== 1) {
      return res.status(404).json({
        ok: false,
        error: 'Notification not found.',
      })
    }

    const notification = result.rows[0]

    return res.status(200).json({
      ok: true,
      notification: {
        id: notification.id,
        type: notification.notification_type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.created_at,
        unread: notification.is_read === false,
      },
    })
  } catch (error) {
    console.error('Customer notification update failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to update the notification.',
    })
  }
}
