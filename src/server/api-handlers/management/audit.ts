import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../db/client.js'
import { requirePermission } from '../../auth/management.js'

function error(response: VercelResponse, status: number, message: string) {
  return response.status(status).json({ ok: false, error: message })
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return error(response, 405, 'Method not allowed.')
  }

  const managementUser = await requirePermission(request, 'audit.view')

  if (!managementUser) {
    return error(response, 403, 'You do not have permission to view audit logs.')
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
      s.staff_number AS actor_staff_number,
      COALESCE(c.first_name, s.first_name) AS actor_first_name,
      COALESCE(c.last_name, s.last_name) AS actor_last_name,
      COALESCE(c.email, s.email) AS actor_email,
      COALESCE(
        c.role::text,
        (
          SELECT mr.role_key
          FROM staff_role_assignments_v2 sr
          JOIN management_roles mr ON mr.id = sr.role_id
          WHERE sr.staff_id = s.id
            AND mr.is_active = TRUE
          ORDER BY sr.assigned_at DESC
          LIMIT 1
        )
      ) AS actor_role
    FROM audit_logs l
    LEFT JOIN customers c
      ON c.id = l.actor_customer_id
    LEFT JOIN staff s
      ON s.id::text = l.metadata->>'actorStaffId'
    ORDER BY l.created_at DESC
    LIMIT 500
  `)

  return response.status(200).json({
    ok: true,
    auditLogs: result.rows,
  })
}
