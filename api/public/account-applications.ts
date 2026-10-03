import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getDb } from '../../src/server/db/client'
import { getCustomerFromSession } from '../../src/server/auth/session'

const applicationSchema = z.object({
  accountType: z.enum(['checking', 'savings', 'business', 'credit']),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(7).max(40),
})

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    })
  }

  const parsed = applicationSchema.safeParse(request.body)

  if (!parsed.success) {
    return response.status(400).json({
      ok: false,
      error: 'Please complete all required application fields.',
    })
  }

  const db = getDb()
  const customer = await getCustomerFromSession(request)

  const result = await db.query(
    `
      INSERT INTO account_applications (
        customer_id,
        account_type,
        first_name,
        last_name,
        email,
        phone,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id, account_type, status, created_at
    `,
    [
      customer?.id ?? null,
      parsed.data.accountType,
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.email,
      parsed.data.phone,
    ],
  )

  const row = result.rows[0]
  const reference = `NSA-${String(row.id)
    .replace(/-/g, '')
    .slice(0, 12)
    .toUpperCase()}`

  return response.status(201).json({
    ok: true,
    application: {
      reference,
      accountType: row.account_type,
      status: row.status,
      createdAt: row.created_at,
    },
  })
}
