import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client.js'
import { requirePermission } from '../../src/server/auth/management.js'

function error(response: VercelResponse, status: number, message: string) {
  return response.status(status).json({ ok: false, error: message })
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const managementUser = await requirePermission(request, 'audit.view')

  if (!managementUser) {
    return error(response, 403, 'You do not have permission to view audit logs.')
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return error(response, 405, 'Method not allowed.')
  }

  const db = getDb()

  const result = await db.query(`
    SELECT
      l.id,
      l.action,
      l.resource_type,
      l.resource_id,
      l.description,
      l.ip_address,
      l.user_agent,
      l.metadata,
      l.created_at,
      c.customer_number AS actor_customer_number,
      c.first_name AS actor_first_name,
      c.last_name AS actor_last_name,
      c.email AS actor_email,
      c.role AS actor_role
    FROM audit_logs l
    LEFT JOIN customers c
      ON c.id = l.actor_customer_id
    ORDER BY l.created_at DESC
    LIMIT 500
  `)

  return response.status(200).json({
    ok: true,
    auditLogs: result.rows,
  })
}
