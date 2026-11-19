import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireCustomer } from '../../../auth/customer.js'
import { writeAuditLog } from '../../../auth/audit.js'
import { getDb } from '../../../db/client.js'

const schema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  cardCategory: z.enum(['savings', 'checking', 'credit', 'business']),
  cardFormat: z.enum(['physical', 'virtual']).default('physical'),
  customerNotes: z.string().trim().max(500).optional().default(''),
})

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (!['GET', 'POST'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed.' })
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

    if (req.method === 'GET') {
      const result = await db.query(
        `SELECT id, account_id, card_category, card_format, status,
                customer_notes, review_notes, reviewed_at, issued_at,
                created_at, updated_at
         FROM card_requests
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [customer.id],
      )
      return res.status(200).json({ ok: true, requests: result.rows })
    }

    const parsed = schema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid card request.',
      })
    }

    const input = parsed.data
    const accountId = input.accountId ?? null

    if (accountId) {
      const account = await db.query(
        `SELECT id FROM accounts
         WHERE id = $1 AND customer_id = $2
         LIMIT 1`,
        [accountId, customer.id],
      )
      if (!account.rowCount) {
        return res.status(400).json({
          ok: false,
          error: 'Choose one of your own accounts.',
        })
      }
    }

    const result = await db.query(
      `INSERT INTO card_requests
         (customer_id, account_id, card_category, card_format, customer_notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, account_id, card_category, card_format, status,
                 customer_notes, created_at, updated_at`,
      [
        customer.id,
        accountId,
        input.cardCategory,
        input.cardFormat,
        input.customerNotes,
      ],
    )

    const request = result.rows[0]

    try {
      await writeAuditLog(
        req,
        customer.id,
        'card_request.created',
        'card_request',
        request.id,
        'Customer submitted a card request.',
        { cardCategory: input.cardCategory, cardFormat: input.cardFormat },
      )
    } catch (auditError) {
      console.error('Card request audit logging failed:', auditError)
    }

    return res.status(201).json({ ok: true, request })
  } catch (error) {
    console.error('Customer card request failed:', error)
    return res.status(500).json({
      ok: false,
      error: 'Unable to process the card request.',
    })
  }
}
