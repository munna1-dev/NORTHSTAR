import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCustomer } from '../../../src/server/auth/customer.js'
import { getDb } from '../../../src/server/db/client.js'

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

    const db = getDb()

    const result = await db.query(
      `
        SELECT
          c.id,
          c.account_id,
          c.card_type,
          c.last_four,
          c.status,
          c.expiry_month,
          c.expiry_year,
          c.created_at,
          c.updated_at,
          a.account_number,
          a.account_type,
          a.currency,
          a.available_balance,
          a.current_balance
        FROM cards c
        LEFT JOIN accounts a
          ON a.id = c.account_id
         AND a.customer_id = c.customer_id
        WHERE c.customer_id = $1
        ORDER BY
          CASE c.status
            WHEN 'active' THEN 1
            WHEN 'locked' THEN 2
            WHEN 'pending' THEN 3
            WHEN 'expired' THEN 4
            WHEN 'cancelled' THEN 5
            ELSE 6
          END,
          c.created_at DESC
      `,
      [customer.id],
    )

    return res.status(200).json({
      ok: true,
      cards: result.rows.map((card) => ({
        id: card.id,
        accountId: card.account_id,
        cardType: card.card_type,
        lastFour: card.last_four,
        status: card.status,
        expiryMonth: card.expiry_month,
        expiryYear: card.expiry_year,
        createdAt: card.created_at,
        updatedAt: card.updated_at,
        linkedAccount: card.account_id
          ? {
              accountNumber: card.account_number,
              accountType: card.account_type,
              currency: card.currency,
              availableBalance: Number(card.available_balance),
              currentBalance: Number(card.current_balance),
            }
          : null,
      })),
    })
  } catch (error) {
    console.error('Customer cards lookup failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to load customer cards.',
    })
  }
}
