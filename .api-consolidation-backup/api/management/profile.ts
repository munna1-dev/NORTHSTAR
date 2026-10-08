import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client.js'
import { writeAuditLog } from '../../src/server/auth/audit.js'
import { hasManagementPermission, requirePermission } from '../../src/server/auth/management.js'

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
          s.id,
          s.staff_number,
          s.first_name,
          s.last_name,
          s.email,
          s.phone,
          s.status,
          s.employee_number,
          s.department,
          s.two_factor_enabled,
          COALESCE(
            (
              SELECT mr.role_key
              FROM staff_role_assignments_v2 sra
              JOIN management_roles mr
                ON mr.id = sra.role_id
              WHERE sra.staff_id = s.id
                AND mr.is_active = true
              ORDER BY sra.assigned_at DESC
              LIMIT 1
            ),
            'staff'
          ) AS role
        FROM staff s
        WHERE s.id = $1
        LIMIT 1
      `,
      [managementUser.id],
    )

    if (result.rowCount !== 1) {
      return error(response, 404, 'Management profile not found.')
    }

    const canUpdate = await hasManagementPermission(
      managementUser,
      'profile.update',
    )

    return response.status(200).json({
      ok: true,
      profile: { ...result.rows[0], can_update: canUpdate },
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
      UPDATE staff
      SET
        first_name = $1,
        last_name = $2,
        phone = NULLIF($3, ''),
        updated_at = NOW()
      WHERE id = $4
      RETURNING
        id,
        staff_number,
        first_name,
        last_name,
        email,
        phone,
        status,
        employee_number,
        department,
        two_factor_enabled
    `,
    [firstName, lastName, phone, managementUser.id],
  )

  if (result.rowCount !== 1) {
    return error(response, 404, 'Management profile not found.')
  }

  await writeAuditLog(
    request,
    managementUser.id,
    'management.profile.update',
    'staff',
    managementUser.id,
    'Management profile updated.',
    {
      fields: ['first_name', 'last_name', 'phone'],
    },
  )

  return response.status(200).json({
    ok: true,
    profile: { ...result.rows[0], can_update: true },
  })
}
