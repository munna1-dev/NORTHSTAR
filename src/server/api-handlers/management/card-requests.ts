import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomInt } from 'node:crypto'
import { requirePermission } from '../../auth/management.js'
import { writeStaffAuditLog } from '../../auth/audit.js'
import { getDb } from '../../db/client.js'

const STATUSES = new Set([
  'pending', 'approved', 'rejected', 'issued', 'cancelled',
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

    const user = await requirePermission(
      req,
      req.method === 'GET' ? 'cards.view' : 'cards.manage',
    )

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
          SELECT cr.id, cr.customer_id, cr.account_id,
            cr.card_category, cr.card_format, cr.status,
            cr.customer_notes, cr.review_notes,
            cr.reviewed_by, cr.reviewed_at,
            cr.issued_card_id, cr.issued_at,
            cr.created_at, cr.updated_at,
            c.customer_number, c.first_name, c.last_name, c.email,
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

      return res.status(200).json({ ok: true, requests: result.rows })
    }

    const requestId = String(req.body?.requestId ?? '').trim()
    const action = String(req.body?.action ?? '').trim()
    const status = String(req.body?.status ?? '').trim()
    const reviewNotes = req.body?.reviewNotes === undefined
      ? ''
      : String(req.body.reviewNotes).trim()

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return error(res, 400, 'A valid card request ID is required.')
    }

    if (action === 'issue') {
      const client = await db.connect()

      try {
        await client.query('BEGIN')

        const existing = await client.query(
          `SELECT id, customer_id, account_id, card_category,
                  card_format, status, issued_card_id
           FROM card_requests WHERE id = $1 FOR UPDATE`,
          [requestId],
        )

        if (existing.rowCount !== 1) {
          await client.query('ROLLBACK')
          return error(res, 404, 'Card request not found.')
        }

        const request = existing.rows[0]

        if (request.status !== 'approved' || request.issued_card_id) {
          await client.query('ROLLBACK')
          return error(res, 409, 'Only approved, not-yet-issued requests can be issued.')
        }

        // This is an internal pending card record, not a network payment card.
        const lastFour = String(randomInt(0, 10000)).padStart(4, '0')
        const expiry = new Date()
        expiry.setMonth(expiry.getMonth() + 60)
        const expiryMonth = expiry.getMonth() + 1
        const expiryYear = expiry.getFullYear()
        const cardType = `${request.card_category}_${request.card_format}`

        const card = await client.query(
          `INSERT INTO cards
             (customer_id, account_id, card_type, last_four,
              status, expiry_month, expiry_year)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6)
           RETURNING id`,
          [
            request.customer_id,
            request.account_id,
            cardType,
            lastFour,
            expiryMonth,
            expiryYear,
          ],
        )

        const cardId = card.rows[0].id

        await client.query(
          `UPDATE card_requests
           SET status = 'issued',
               issued_card_id = $1,
               issued_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [cardId, requestId],
        )

        await writeStaffAuditLog(
          req,
          user.id,
          'card_request.issued',
          'card_request',
          requestId,
          'Internal pending card record issued by management.',
          { requestId, cardId, cardType, status: 'pending' },
          client,
        )

        await client.query('COMMIT')

        return res.status(200).json({
          ok: true,
          message: 'Internal card record issued. Processor activation is still required.',
          cardId,
        })
      } catch (transactionError) {
        await client.query('ROLLBACK')
        throw transactionError
      } finally {
        client.release()
      }
    }

    if (!['approved', 'rejected'].includes(status)) {
      return error(res, 400, 'Only approval, rejection, or the separate issue action is supported.')
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
        `SELECT id, status FROM card_requests WHERE id = $1 FOR UPDATE`,
        [requestId],
      )

      if (existing.rowCount !== 1) {
        await client.query('ROLLBACK')
        return error(res, 404, 'Card request not found.')
      }

      if (existing.rows[0].status !== 'pending') {
        await client.query('ROLLBACK')
        return error(res, 409, 'Only pending card requests can be reviewed.')
      }

      await client.query(
        `UPDATE card_requests
         SET status = $1, review_notes = $2, reviewed_by = $3,
             reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, reviewNotes || null, user.id, requestId],
      )

      await writeStaffAuditLog(
        req,
        user.id,
        `card_request.${status}`,
        'card_request',
        requestId,
        `Card request ${status} by management user.`,
        { requestId, status, reviewNotes },
        client,
      )

      await client.query('COMMIT')
    } catch (transactionError) {
      await client.query('ROLLBACK')
      throw transactionError
    } finally {
      client.release()
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
