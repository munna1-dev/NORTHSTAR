import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client.js'
import { writeAuditLog } from '../../src/server/auth/audit.js'
import { requirePermission } from '../../src/server/auth/management.js'

function error(
  response: VercelResponse,
  status: number,
  message: string,
) {
  return response.status(status).json({
    ok: false,
    error: message,
  })
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    return error(response, 405, 'Method not allowed.')
  }

  const permission =
    request.method === 'GET' ? 'profile.view' : 'profile.update'

  const managementUser = await requirePermission(request, permission)

  if (!managementUser) {
    return error(
      response,
      403,
      'You do not have permission to access your management profile.',
    )
  }

  const db = getDb()

  if (request.method === 'GET') {
    const result = await db.query(
      `
        SELECT
          c.id,
          c.customer_number,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.role,
          c.status,
          c.staff_id,
          c.employee_number,
          c.department,
          c.staff_status,
          c.two_factor_enabled
        FROM customers c
        WHERE c.id = $1
        LIMIT 1
      `,
      [managementUser.id],
    )

    if (result.rowCount !== 1) {
      return error(response, 404, 'Management profile not found.')
    }

    return response.status(200).json({
      ok: true,
      profile: result.rows[0],
    })
  }

  const body =
    typeof request.body === 'object' && request.body !== null
      ? (request.body as Record<string, unknown>)
      : {}

  const firstName = clean(body.firstName)
  const lastName = clean(body.lastName)
  const phone = clean(body.phone)

  if (!firstName || !lastName) {
    return error(
      response,
      400,
      'First name and last name are required.',
    )
  }

  if (firstName.length > 80 || lastName.length > 80) {
    return error(response, 400, 'Name fields are too long.')
  }

  if (phone.length > 40) {
    return error(response, 400, 'Phone number is too long.')
  }

  const result = await db.query(
    `
      UPDATE customers
      SET
        first_name = $1,
        last_name = $2,
        phone = NULLIF($3, ''),
        updated_at = NOW()
      WHERE id = $4
      RETURNING
        id,
        customer_number,
        first_name,
        last_name,
        email,
        phone,
        role,
        status,
        staff_id,
        employee_number,
        department,
        staff_status,
        two_factor_enabled
    `,
    [firstName, lastName, phone, managementUser.id],
  )

  if (result.rowCount !== 1) {
    return error(response, 404, 'Management profile not found.')
  }

  await writeAuditLog({
    actorCustomerId: managementUser.id,
    action: 'management.profile.update',
    entityType: 'customer',
    entityId: managementUser.id,
    metadata: {
      fields: ['first_name', 'last_name', 'phone'],
    },
  })

  return response.status(200).json({
    ok: true,
    profile: result.rows[0],
  })
}
