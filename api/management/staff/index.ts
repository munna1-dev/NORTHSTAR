import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../../src/server/db/client.js'
import { requirePermission } from '../../../src/server/auth/management.js'
import { writeAuditLog } from '../../../src/server/auth/audit.js'

function json(response: VercelResponse, status: number, body: unknown) {
  return response.status(status).json(body)
}

function error(response: VercelResponse, status: number, message: string) {
  return json(response, status, { error: message })
}

function isSuperManager(role: string) {
  return role === 'super_manager'
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (!['GET', 'PATCH', 'POST'].includes(request.method ?? '')) {
    response.setHeader('Allow', 'GET, PATCH, POST')
    return error(response, 405, 'Method not allowed.')
  }

  const user = await requirePermission(request, 'staff.view')

  if (!user) {
    return error(response, 403, 'You do not have permission to access staff controls.')
  }

  if (!isSuperManager(user.role)) {
    return error(response, 403, 'Super Manager authorization is required.')
  }

  const db = getDb()

  try {
    if (request.method === 'GET') {
      const section =
        typeof request.query.section === 'string'
          ? request.query.section
          : 'staff'

      if (section === 'applications') {
        const result = await db.query(`
          SELECT
            id,
            customer_id,
            first_name,
            last_name,
            email,
            phone,
            employee_number,
            requested_department,
            requested_role,
            status,
            application_notes,
            review_notes,
            reviewed_by,
            reviewed_at,
            created_at,
            updated_at
          FROM staff_applications
          ORDER BY created_at DESC
          LIMIT 200
        `)

        return json(response, 200, {
          applications: result.rows,
        })
      }

      if (section === 'roles') {
        const result = await db.query(`
          SELECT
            r.id,
            r.role_key,
            r.role_name,
            r.description,
            r.is_system_role,
            r.is_active,
            r.created_at,
            r.updated_at,
            COUNT(DISTINCT sra.customer_id)::int AS staff_count
          FROM management_roles r
          LEFT JOIN staff_role_assignments sra
            ON sra.role_id = r.id
          GROUP BY
            r.id,
            r.role_key,
            r.role_name,
            r.description,
            r.is_system_role,
            r.is_active,
            r.created_at,
            r.updated_at
          ORDER BY r.role_name
        `)

        return json(response, 200, {
          roles: result.rows,
        })
      }

      if (section === 'permissions') {
        const result = await db.query(`
          SELECT
            id,
            permission_key,
            permission_name,
            permission_group,
            description
          FROM management_permissions
          ORDER BY permission_group, permission_key
        `)

        return json(response, 200, {
          permissions: result.rows,
        })
      }

      const result = await db.query(`
        SELECT
          c.id,
          c.customer_number,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.status,
          c.role,
          c.staff_status,
          c.employee_number,
          c.department,
          c.approved_by,
          c.approved_at,
          c.blocked_by,
          c.blocked_at,
          c.block_reason,
          c.created_at,
          c.updated_at,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', r.id,
                'roleKey', r.role_key,
                'roleName', r.role_name
              )
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'::json
          ) AS roles
        FROM customers c
        LEFT JOIN staff_role_assignments sra
          ON sra.customer_id = c.id
        LEFT JOIN management_roles r
          ON r.id = sra.role_id
        WHERE c.role IN ('management', 'developer', 'super_manager')
           OR c.staff_status IS NOT NULL
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 500
      `)

      return json(response, 200, {
        staff: result.rows,
      })
    }

    if (request.method === 'POST') {
      const action =
        typeof request.body?.action === 'string'
          ? request.body.action.trim()
          : ''

      if (action !== 'assign-role' && action !== 'assign-permission') {
        return error(response, 400, 'Unsupported staff action.')
      }

      const customerId =
        typeof request.body?.customerId === 'string'
          ? request.body.customerId.trim()
          : ''

      if (!customerId) {
        return error(response, 400, 'customerId is required.')
      }

      if (customerId === user.id) {
        return error(
          response,
          400,
          'The Super Manager account cannot modify its own staff authorization.',
        )
      }

      if (action === 'assign-role') {
        const roleKey =
          typeof request.body?.roleKey === 'string'
            ? request.body.roleKey.trim()
            : ''

        if (!roleKey) {
          return error(response, 400, 'roleKey is required.')
        }

        const roleResult = await db.query(
          `
            SELECT id, role_key, role_name, is_active
            FROM management_roles
            WHERE role_key = $1
            LIMIT 1
          `,
          [roleKey],
        )

        if (roleResult.rowCount !== 1) {
          return error(response, 404, 'Management role not found.')
        }

        if (!roleResult.rows[0].is_active) {
          return error(response, 400, 'The selected role is inactive.')
        }

        if (roleKey === 'super_manager') {
          return error(
            response,
            400,
            'The Super Manager role cannot be assigned through this endpoint.',
          )
        }

        await db.query(
          `
            INSERT INTO staff_role_assignments (
              customer_id,
              role_id,
              assigned_by
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (customer_id, role_id)
            DO UPDATE SET
              assigned_by = EXCLUDED.assigned_by,
              assigned_at = CURRENT_TIMESTAMP
          `,
          [customerId, roleResult.rows[0].id, user.id],
        )

        return json(response, 200, {
          success: true,
          action,
          customerId,
          role: roleResult.rows[0],
        })
      }

      const permissionKey =
        typeof request.body?.permissionKey === 'string'
          ? request.body.permissionKey.trim()
          : ''

      const effect =
        typeof request.body?.effect === 'string'
          ? request.body.effect.trim()
          : ''

      if (!permissionKey || !['allow', 'deny'].includes(effect)) {
        return error(
          response,
          400,
          'permissionKey and effect (allow or deny) are required.',
        )
      }

      const permissionResult = await db.query(
        `
          SELECT
            id,
            permission_key,
            permission_name,
            permission_group
          FROM management_permissions
          WHERE permission_key = $1
          LIMIT 1
        `,
        [permissionKey],
      )

      if (permissionResult.rowCount !== 1) {
        return error(response, 404, 'Management permission not found.')
      }

      await db.query(
        `
          INSERT INTO staff_permission_assignments (
            customer_id,
            permission_id,
            effect,
            assigned_by
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (customer_id, permission_id)
          DO UPDATE SET
            effect = EXCLUDED.effect,
            assigned_by = EXCLUDED.assigned_by,
            assigned_at = CURRENT_TIMESTAMP
        `,
        [
          customerId,
          permissionResult.rows[0].id,
          effect,
          user.id,
        ],
      )

      return json(response, 200, {
        success: true,
        action,
        customerId,
        permission: permissionResult.rows[0],
        effect,
      })
    }

    const action =
      typeof request.body?.action === 'string'
        ? request.body.action.trim()
        : ''

    if (action === 'approve-application' || action === 'reject-application') {
      const applicationId =
        typeof request.body?.applicationId === 'string'
          ? request.body.applicationId.trim()
          : ''

      const reviewNotes =
        typeof request.body?.reviewNotes === 'string'
          ? request.body.reviewNotes.trim()
          : ''

      if (!applicationId) {
        return error(response, 400, 'applicationId is required.')
      }

      if (action === 'reject-application' && reviewNotes.length < 3) {
        return error(
          response,
          400,
          'A review note is required when rejecting a staff application.',
        )
      }

      const client = await db.connect()

      try {
        await client.query('BEGIN')

        const applicationResult = await client.query(
          `
            SELECT
              id,
              customer_id,
              first_name,
              last_name,
              email,
              phone,
              employee_number,
              requested_department,
              requested_role,
              status
            FROM staff_applications
            WHERE id = $1
            FOR UPDATE
          `,
          [applicationId],
        )

        if (applicationResult.rowCount !== 1) {
          await client.query('ROLLBACK')
          return error(response, 404, 'Staff application not found.')
        }

        const application = applicationResult.rows[0]

        if (application.status !== 'pending') {
          await client.query('ROLLBACK')
          return error(
            response,
            409,
            `This staff application is already ${application.status}.`,
          )
        }

        if (action === 'reject-application') {
          await client.query(
            `
              UPDATE staff_applications
              SET
                status = 'rejected',
                review_notes = $1,
                reviewed_by = $2,
                reviewed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $3
            `,
            [reviewNotes, user.id, applicationId],
          )

          await client.query('COMMIT')

          await writeAuditLog(
            request,
            user.id,
            'staff_application.rejected',
            'staff_application',
            applicationId,
            'Staff application rejected by Super Manager.',
            {
              applicationId,
              reviewNotes,
            },
          )

          return json(response, 200, {
            success: true,
            action,
            applicationId,
            status: 'rejected',
          })
        }

        if (!application.customer_id) {
          await client.query('ROLLBACK')
          return error(
            response,
            409,
            'This staff application is not linked to an existing customer account.',
          )
        }

        const requestedRole =
          typeof application.requested_role === 'string'
            ? application.requested_role.trim()
            : ''

        if (!requestedRole) {
          await client.query('ROLLBACK')
          return error(
            response,
            409,
            'The staff application does not specify a requested role.',
          )
        }

        if (requestedRole === 'super_manager') {
          await client.query('ROLLBACK')
          return error(
            response,
            400,
            'A staff application cannot grant the Super Manager role.',
          )
        }

        const roleResult = await client.query(
          `
            SELECT id, role_key, role_name, is_active
            FROM management_roles
            WHERE role_key = $1
            LIMIT 1
          `,
          [requestedRole],
        )

        if (roleResult.rowCount !== 1) {
          await client.query('ROLLBACK')
          return error(response, 404, 'Requested management role not found.')
        }

        if (!roleResult.rows[0].is_active) {
          await client.query('ROLLBACK')
          return error(response, 400, 'Requested management role is inactive.')
        }

        const employeeNumber =
          typeof application.employee_number === 'string'
            ? application.employee_number.trim() || null
            : null

        if (employeeNumber) {
          const employeeResult = await client.query(
            `
              SELECT id
              FROM customers
              WHERE employee_number = $1
                AND id <> $2
              LIMIT 1
            `,
            [employeeNumber, application.customer_id],
          )

          if (employeeResult.rowCount !== 0) {
            await client.query('ROLLBACK')
            return error(response, 409, 'Employee number is already assigned.')
          }
        }

        await client.query(
          `
            UPDATE customers
            SET
              role = 'management',
              staff_status = 'active',
              employee_number = $1,
              department = $2,
              approved_by = $3,
              approved_at = CURRENT_TIMESTAMP,
              blocked_by = NULL,
              blocked_at = NULL,
              block_reason = NULL,
              status = 'active',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
          `,
          [
            employeeNumber,
            application.requested_department ?? null,
            user.id,
            application.customer_id,
          ],
        )

        await client.query(
          `
            INSERT INTO staff_role_assignments (
              customer_id,
              role_id,
              assigned_by
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (customer_id, role_id)
            DO UPDATE SET
              assigned_by = EXCLUDED.assigned_by,
              assigned_at = CURRENT_TIMESTAMP
          `,
          [
            application.customer_id,
            roleResult.rows[0].id,
            user.id,
          ],
        )

        await client.query(
          `
            UPDATE staff_applications
            SET
              status = 'approved',
              review_notes = $1,
              reviewed_by = $2,
              reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `,
          [
            reviewNotes || null,
            user.id,
            applicationId,
          ],
        )

        await client.query('COMMIT')

        await writeAuditLog(
          request,
          user.id,
          'staff_application.approved',
          'staff_application',
          applicationId,
          'Staff application approved by Super Manager.',
          {
            applicationId,
            customerId: application.customer_id,
            role: requestedRole,
            department: application.requested_department ?? null,
            employeeNumber,
          },
        )

        return json(response, 200, {
          success: true,
          action,
          applicationId,
          status: 'approved',
          customerId: application.customer_id,
          role: roleResult.rows[0],
          employeeNumber,
          department: application.requested_department ?? null,
        })
      } catch (cause) {
        await client.query('ROLLBACK')
        throw cause
      } finally {
        client.release()
      }
    }

    const customerId =
      typeof request.body?.customerId === 'string'
        ? request.body.customerId.trim()
        : ''

    if (!customerId || !action) {
      return error(response, 400, 'customerId and action are required.')
    }

    if (customerId === user.id) {
      return error(
        response,
        400,
        'The Super Manager account cannot modify its own staff status.',
      )
    }

    const allowedActions = new Map<string, string>([
      ['activate', 'active'],
      ['suspend', 'suspended'],
      ['block', 'blocked'],
      ['reactivate', 'active'],
      ['terminate', 'terminated'],
    ])

    const nextStatus = allowedActions.get(action)

    if (!nextStatus) {
      return error(response, 400, 'Unsupported staff status action.')
    }

    const result = await db.query(
      `
        UPDATE customers
        SET
          staff_status = $1,
          status = CASE
            WHEN $1 = 'terminated' THEN 'closed'
            WHEN $1 = 'blocked' THEN 'suspended'
            ELSE 'active'
          END,
          blocked_by = CASE
            WHEN $1 = 'blocked' THEN $2
            ELSE blocked_by
          END,
          blocked_at = CASE
            WHEN $1 = 'blocked' THEN CURRENT_TIMESTAMP
            ELSE blocked_at
          END,
          block_reason = CASE
            WHEN $1 = 'blocked' THEN COALESCE($3, block_reason)
            ELSE block_reason
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
          AND id <> $2
          AND (
            role IN ('management', 'developer', 'super_manager')
            OR staff_status IS NOT NULL
          )
        RETURNING
          id,
          customer_number,
          first_name,
          last_name,
          email,
          status,
          role,
          staff_status,
          employee_number,
          department,
          updated_at
      `,
      [
        nextStatus,
        user.id,
        typeof request.body?.reason === 'string'
          ? request.body.reason.trim() || null
          : null,
        customerId,
      ],
    )

    if (result.rowCount !== 1) {
      return error(response, 404, 'Staff member not found.')
    }

    return json(response, 200, {
      success: true,
      action,
      staff: result.rows[0],
    })
  } catch (cause) {
    console.error('Management staff API error:', cause)
    return error(response, 500, 'Unable to complete the staff operation.')
  }
}
