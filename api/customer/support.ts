import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getDb } from '../../src/server/db/client.js'
import { requireCustomer } from '../../src/server/auth/customer.js'

const createTicketSchema = z.object({
  category: z.enum([
    'Account access',
    'Payments',
    'Transfers',
    'Transactions',
    'Cards',
    'Other',
  ]),
  subject: z.string().trim().min(3).max(250),
  message: z.string().trim().min(10).max(5000),
})

function ticketResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    reference: `NSB-${String(row.id).replace(/-/g, '').slice(0, 10).toUpperCase()}`,
    subject: row.subject,
    category: row.category,
    message: row.message,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const customer = await requireCustomer(request)

  if (!customer) {
    return response.status(401).json({
      ok: false,
      error: 'Authentication required.',
    })
  }

  const db = getDb()

  if (request.method === 'GET') {
    const result = await db.query(
      `
        SELECT
          id,
          subject,
          category,
          message,
          status,
          priority,
          created_at,
          updated_at,
          resolved_at
        FROM support_tickets
        WHERE customer_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [customer.id],
    )

    return response.status(200).json({
      ok: true,
      tickets: result.rows.map(ticketResponse),
    })
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    })
  }

  const parsed = createTicketSchema.safeParse(request.body)

  if (!parsed.success) {
    return response.status(400).json({
      ok: false,
      error: 'Please provide a valid category, subject, and message.',
    })
  }

  const result = await db.query(
    `
      INSERT INTO support_tickets (
        customer_id,
        subject,
        category,
        message,
        status,
        priority
      )
      VALUES ($1, $2, $3, $4, 'open', 'normal')
      RETURNING
        id,
        subject,
        category,
        message,
        status,
        priority,
        created_at,
        updated_at,
        resolved_at
    `,
    [
      customer.id,
      parsed.data.subject,
      parsed.data.category,
      parsed.data.message,
    ],
  )

  return response.status(201).json({
    ok: true,
    ticket: ticketResponse(result.rows[0]),
  })
}
