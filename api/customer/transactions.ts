import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCustomer } from '../../src/server/auth/customer'
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
    const customer = await requireCustomer(req)

    if (!customer) {
      return res.status(401).json({
        ok: false,
        authenticated: false,
        error: 'Not authenticated.',
      })
    }

    const accountId =
      typeof req.query.account === 'string'
        ? req.query.account.trim()
        : ''

    const search =
      typeof req.query.search === 'string'
        ? req.query.search.trim()
        : ''

    const limitRaw =
      typeof req.query.limit === 'string'
        ? Number(req.query.limit)
        : 100

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200)
      : 100

    const db = getDb()

    const result = await db.query(
      `
        SELECT
          t.id,
          t.account_id,
          t.reference,
          t.transaction_type,
          t.status,
          t.description,
          t.amount,
          t.currency,
          t.created_at
        FROM transactions t
        JOIN accounts a
          ON a.id = t.account_id
        WHERE a.customer_id = $1
          AND ($2 = '' OR a.id = $3)
          AND (
            $4 = ''
            OR t.description LIKE '%' || $5 || '%'
            OR t.reference LIKE '%' || $6 || '%'
            OR t.transaction_type LIKE '%' || $7 || '%'
            OR t.status LIKE '%' || $8 || '%'
          )
        ORDER BY t.created_at DESC
        LIMIT $9
      `,
      [customer.id, accountId, search, limit],
    )

    return res.status(200).json({
      ok: true,
      transactions: result.rows.map((transaction) => ({
        id: transaction.id,
        accountId: transaction.account_id,
        reference: transaction.reference,
        type: transaction.transaction_type,
        status: transaction.status,
        description: transaction.description,
        amount: Number(transaction.amount),
        currency: transaction.currency,
        createdAt: transaction.created_at,
      })),
    })
  } catch (error) {
    console.error('Customer transactions lookup failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to load customer transactions.',
    })
  }
}
