import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requirePermission } from '../../auth/management.js'
import { writeStaffAuditLog } from '../../auth/audit.js'
import { getDb } from '../../db/client.js'

const STATUSES = new Set([
  'pending',
  'approved',
  'rejected',
  'issued',
  'cancelled',
])

function error(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ ok: false, error: message })
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    if (req.method !== 'GET' && req.method !== 'PATCH') {
      res.setHeader('Allow', 'GET, PATCH')
      return error(res, 405, 'Method not allowed.')
    }

    const permission =
      req.method === 'GET' ? 'cards.view' : 'cards.manage'

    const user = await requirePermission(req, permission)

    if (!user) {
      return error(res, 403, 'You do not have permission to manage card requests.')
    }

    const db = getDb()

    if (req.method === 'GET') {
      const status = String(req.query.status ?? '').trim()
      const values: string[] = []
      let where = ''

      if (status) {
        if (!STATUSES.has(status)) {
          return error(res, 400, 'Invalid card request status.')
        }

        values.push(status)
        where = 'WHERE cr.status = $1'
      }

      const result = await db.query(
        `
          SELECT
            cr.id,
            cr.customer_id,
            cr.account_id,
            cr.card_category,
            cr.card_format,
            cr.status,
            cr.customer_notes,
            cr.review_notes,
            cr.reviewed_by,
            cr.reviewed_at,
            cr.issued_card_id,
            cr.issued_at,
            cr.created_at,
            cr.updated_at,
            c.customer_number,
            c.first_name,
            c.last_name,
            c.email,
            a.account_number
          FROM card_requests cr
          INNER JOIN customers c ON c.id = cr.customer_id
          LEFT JOIN accounts a ON a.id = cr.account_id
          ${where}
          ORDER BY
            CASE cr.status
              WHEN 'pending' THEN 1
              WHEN 'approved' THEN 2
              WHEN 'rejected' THEN 3
              WHEN 'issued' THEN 4
              ELSE 5
            END,
            cr.created_at DESC
          LIMIT 250
        `,
        values,
      )

      return res.status(200).json({
        ok: true,
        requests: result.rows,
      })
    }

    const requestId = String(req.body?.requestId ?? '').trim()
    const status = String(req.body?.status ?? '').trim()
    const reviewNotes =
      req.body?.reviewNotes === undefined
        ? ''
        : String(req.body.reviewNotes).trim()

    if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
      return error(res, 400, 'A valid card request ID is required.')
    }

    if (!['approved', 'rejected'].includes(status)) {
      return error(res, 400, 'Only approval or rejection is supported here.')
    }

    if (reviewNotes.length > 1000) {
      return error(res, 400, 'Review notes must be 1000 characters or fewer.')
    }

    if (status === 'rejected' && reviewNotes.length < 3) {
      return error(res, 400, 'A review note is required when rejecting a request.')
    }

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const existing = await client.query(
        `
          SELECT id, status
          FROM card_requests
          WHERE id = $1
          FOR UPDATE
        `,
        [requestId],
      )

      if (existing.rowCount !== 1) {
        await client.query('ROLLBACK')
        return error(res, 404, 'Card request not found.')
      }

      if (existing.rows[0].status !== 'pending') {
        await client.query('ROLLBACK')
        return error(
          res,
          409,
          'Only pending card requests can be reviewed.',
        )
      }

      await client.query(
        `
          UPDATE card_requests
          SET status = $1,
              review_notes = $2,
              reviewed_by = $3,
              reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `,
        [status, reviewNotes || null, user.id, requestId],
      )

      await client.query('COMMIT')
    } catch (transactionError) {
      await client.query('ROLLBACK')
      throw transactionError
    } finally {
      client.release()
    }

    try {
      await writeStaffAuditLog(
        req,
        user.id,
        `card_request.${status}`,
        'card_request',
        requestId,
        `Card request ${status} by management user.`,
        { requestId, status, reviewNotes },
      )
    } catch (auditError) {
      console.error('Card request audit logging failed:', auditError)
    }

    return res.status(200).json({
      ok: true,
      message: `Card request ${status}.`,
    })
  } catch (handlerError) {
    console.error('Management card requests failed:', handlerError)
    return error(res, 500, 'Unable to process card request.')
  }
}
