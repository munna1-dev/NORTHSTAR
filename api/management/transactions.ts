import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client'
import { requireManagement } from '../../src/server/auth/management'

function error(response: VercelResponse, status: number, message: string) {
  return response.status(status).json({ ok: false, error: message })
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const managementUser = await requireManagement(request)

  if (!managementUser) {
    return error(response, 401, 'Management authentication required.')
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return error(response, 405, 'Method not allowed.')
  }

  const db = getDb()

  const search =
    typeof request.query.search === 'string'
      ? request.query.search.trim()
      : ''

  const values: unknown[] = []
  let where = ''

  if (search) {
    values.push(`%${search}%`)
    const parameter = `$${values.length}`

    where = `
      WHERE
        t.transaction_reference LIKE ${parameter}
        OR t.description LIKE ${parameter}
        OR a.account_number LIKE ${parameter}
        OR c.customer_number LIKE ${parameter}
        OR c.first_name LIKE ${parameter}
        OR c.last_name LIKE ${parameter}
    `
  }

  const result = await db.query(
    `
      SELECT
        t.id,
        t.transaction_reference,
        t.transaction_type,
        t.status,
        t.amount,
        t.currency,
        t.description,
        t.created_at,
        a.account_number,
        a.account_type,
        c.customer_number,
        c.first_name,
        c.last_name
      FROM transactions t
      INNER JOIN accounts a
        ON a.id = t.account_id
      INNER JOIN customers c
        ON c.id = a.customer_id
      ${where}
      ORDER BY t.created_at DESC
      LIMIT 500
    `,
    values,
  )

  return response.status(200).json({
    ok: true,
    transactions: result.rows,
    viewer: managementUser.customer_number,
  })
}
