import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCustomer } from '../../src/server/auth/customer.js'
import { getDb } from '../../src/server/db/client.js'

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
          id,
          account_number,
          account_type,
          status,
          currency,
          available_balance,
          current_balance
        FROM accounts
        WHERE customer_id = $1
        ORDER BY
          CASE account_type
            WHEN 'checking' THEN 1
            WHEN 'savings' THEN 2
            WHEN 'business' THEN 3
            WHEN 'credit' THEN 4
            ELSE 5
          END,
          created_at ASC
      `,
      [customer.id],
    )

    return res.status(200).json({
      ok: true,
      accounts: result.rows.map((account) => ({
        id: account.id,
        accountNumber: account.account_number,
        accountType: account.account_type,
        status: account.status,
        currency: account.currency,
        availableBalance: Number(account.available_balance),
        currentBalance: Number(account.current_balance),
      })),
    })
  } catch (error) {
    console.error('Customer accounts lookup failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to load customer accounts.',
    })
  }
}
