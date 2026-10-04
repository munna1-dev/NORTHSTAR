import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requirePermission } from '../../src/server/auth/management'
import { getDb } from '../../src/server/db/client'

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
    const user = await requirePermission(req, 'reports.view')

    if (!user) {
      return res.status(403).json({
        ok: false,
        error: 'You do not have permission to view management reports.',
      })
    }

    const db = getDb()

    const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM customers WHERE status = 'active')
          AS active_customers,

        (SELECT COUNT(*) FROM customers WHERE status = 'pending')
          AS pending_customers,

        (SELECT COUNT(*) FROM accounts WHERE status = 'active')
          AS active_accounts,

        (SELECT COUNT(*) FROM account_applications
          WHERE status IN ('pending', 'under_review'))
          AS pending_applications,

        (SELECT COUNT(*) FROM support_tickets
          WHERE status IN ('open', 'in_progress', 'waiting_customer'))
          AS open_support_tickets,

        (SELECT COUNT(*) FROM transfers
          WHERE status = 'pending')
          AS pending_transfers,

        (SELECT COUNT(*) FROM payments
          WHERE status = 'pending')
          AS pending_payments,

        (SELECT COUNT(*) FROM audit_logs
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours')
          AS audit_events_24h
    `)

    return res.status(200).json({
      ok: true,
      dashboard: result.rows[0],
    })
  } catch (error) {
    console.error('Management dashboard failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to load management dashboard.',
    })
  }
}
