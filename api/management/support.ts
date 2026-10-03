import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client'
import { writeAuditLog } from '../../src/server/auth/audit'
import { requireManagement } from '../../src/server/auth/management'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const

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

  const db = getDb()

  if (request.method === 'GET') {
    const result = await db.query(`
      SELECT
        s.id,
        s.subject,
        s.message,
        s.status,
        s.priority,
        s.created_at,
        s.updated_at,
        c.id AS customer_id,
        c.customer_number,
        c.first_name,
        c.last_name,
        c.email
      FROM support_tickets s
      INNER JOIN customers c
        ON c.id = s.customer_id
      ORDER BY
        CASE s.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        s.created_at DESC
      LIMIT 300
    `)

    return response.status(200).json({
      ok: true,
      tickets: result.rows,
    })
  }

  if (request.method === 'PATCH') {
    const body =
      typeof request.body === 'object' && request.body !== null
        ? bodyOrEmpty(request.body)
        : {}

    const ticketId =
      typeof body.ticketId === 'string'
        ? body.ticketId.trim()
        : ''

    const status =
      typeof body.status === 'string'
        ? body.status.trim()
        : ''

    if (!ticketId) {
      return error(response, 400, 'Ticket ID is required.')
    }

    if (!STATUSES.includes(status as typeof STATUSES[number])) {
      return error(response, 400, 'Invalid ticket status.')
    }

    const result = await db.query(
      `
        UPDATE support_tickets
        SET
          status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `,
      [status, ticketId],
    )

    if (result.rowCount !== 1) {
      return error(response, 404, 'Support ticket not found.')
    }

    try {
      await writeAuditLog(
        request,
        managementUser.id,
        'support.status_changed',
        'support_ticket',
        ticketId,
        `Support ticket status changed to ${status}.`,
        { newStatus: status },
      )
    } catch (auditError) {
      console.error('Support audit failed:', auditError)
    }

    return response.status(200).json({
      ok: true,
      ticket: result.rows[0],
    })
  }

  response.setHeader('Allow', 'GET, PATCH')
  return error(response, 405, 'Method not allowed.')
}

function bodyOrEmpty(value: object): Record<string, unknown> {
  return value as Record<string, unknown>
}
