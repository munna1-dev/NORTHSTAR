import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { createStaffInvitationToken, sendStaffInvitationEmail } from '../../../email/staff-invitations.js'
import { getDb } from '../../../db/client.js'
import { requirePermission } from '../../../auth/management.js'
import { writeStaffAuditLog } from '../../../auth/audit.js'

function json(response: VercelResponse, status: number, body: unknown) {
  return response.status(status).json(body)
}

function error(response: VercelResponse, status: number, message: string) {
  return json(response, status, { error: message })
}


function isSuperManager(role: string) {
  return role === 'super_manager'
}

async function deliverStaffInvitation(
  db: ReturnType<typeof getDb>,
  input: {
    applicationId: string
    recipientEmail: string
    firstName: string
    staffEmail: string
    token: string
  },
) {
  try {
    await sendStaffInvitationEmail({
      to: input.recipientEmail,
      firstName: input.firstName,
      staffEmail: input.staffEmail,
      token: input.token,
    })

    await db.query(
      `
        UPDATE staff_applications
        SET
          invitation_status = 'sent',
          invitation_sent_at = CURRENT_TIMESTAMP,
          invitation_last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [input.applicationId],
    )

    return true
  } catch (cause) {
    console.error('Staff invitation delivery failed:', cause)

    await db.query(
      `
        UPDATE staff_applications
        SET
          invitation_status = 'failed',
          invitation_last_error = 'Email delivery failed. A Super Manager can retry.',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [input.applicationId],
    )

    return false
  }
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
            generated_staff_email,
            staff_id,
            invitation_status,
            invitation_sent_at,
            invitation_attempts,
            invitation_last_error,
            reviewed_by_staff_id AS reviewed_by,
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
            COUNT(DISTINCT sra.staff_id)::int AS staff_count
          FROM management_roles r
          LEFT JOIN staff_role_assignments_v2 sra
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
            description,
            created_at
          FROM management_permissions
          ORDER BY permission_group, permission_name
        `)

        return json(response, 200, {
          permissions: result.rows,
        })
      }

      const result = await db.query(`
        SELECT
          s.id,
          s.staff_number,
          s.first_name,
          s.last_name,
          s.email,
          s.phone,
          s.status,
          COALESCE(
            (
              SELECT mr.role_key
              FROM staff_role_assignments_v2 sr2
              JOIN management_roles mr
                ON mr.id = sr2.role_id
              WHERE sr2.staff_id = s.id
                AND mr.is_active = TRUE
              ORDER BY sr2.assigned_at DESC
              LIMIT 1
            ),
            'staff'
          ) AS role,
          s.employee_number,
          s.department,
          s.approved_by,
          s.approved_at,
          s.blocked_by,
          s.blocked_at,
          s.block_reason,
          s.created_at,
          s.updated_at,
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
        FROM staff s
        LEFT JOIN staff_role_assignments_v2 sra
          ON sra.staff_id = s.id
        LEFT JOIN management_roles r
          ON r.id = sra.role_id
        GROUP BY s.id
        ORDER BY s.created_at DESC
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

      const staffId =
        typeof request.body?.staffId === 'string'
          ? request.body.staffId.trim()
          : ''

      if (!staffId) {
        return error(response, 400, 'staffId is required.')
      }

      if (staffId === user.id) {
        return error(
          response,
          400,
          'The Super Manager account cannot modify its own staff authorization.',
        )
      }

      const staffResult = await db.query(
        `
          SELECT id
          FROM staff
          WHERE id = $1
          LIMIT 1
        `,
        [staffId],
      )

      if (staffResult.rowCount !== 1) {
        return error(response, 404, 'Staff member not found.')
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
            INSERT INTO staff_role_assignments_v2 (
              staff_id,
              role_id,
              assigned_by
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (staff_id, role_id)
            DO UPDATE SET
              assigned_by = EXCLUDED.assigned_by,
              assigned_at = CURRENT_TIMESTAMP
          `,
          [staffId, roleResult.rows[0].id, user.id],
        )

        return json(response, 200, {
          success: true,
          action,
          staffId,
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
          INSERT INTO staff_permission_assignments_v2 (
            staff_id,
            permission_id,
            effect,
            assigned_by
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (staff_id, permission_id)
          DO UPDATE SET
            effect = EXCLUDED.effect,
            assigned_by = EXCLUDED.assigned_by,
            assigned_at = CURRENT_TIMESTAMP
        `,
        [
          staffId,
          permissionResult.rows[0].id,
          effect,
          user.id,
        ],
      )

      return json(response, 200, {
        success: true,
        action,
        staffId,
        permission: permissionResult.rows[0],
        effect,
      })
    }
    const action =
      typeof request.body?.action === 'string'
        ? request.body.action.trim()
        : ''


    if (
      action === 'approve-application' ||
      action === 'reject-application' ||
      action === 'resend-invitation'
    ) {
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
      let delivery:
        | {
            token: string
            recipientEmail: string
            firstName: string
            staffEmail: string
          }
        | null = null

      let staffId = ''
      let staffNumber = ''
      let staffEmail = ''
      let requestedRole = ''
      let employeeNumber: string | null = null
      let department: string | null = null

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
              status,
              staff_id,
              generated_staff_email,
              invitation_status
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

        if (action === 'resend-invitation') {
          if (application.status !== 'approved' || !application.staff_id) {
            await client.query('ROLLBACK')
            return error(
              response,
              409,
              'Only an approved application with an assigned staff account can receive an invitation.',
            )
          }

          const staffResult = await client.query(
            `
              SELECT id, first_name, email, status
              FROM staff
              WHERE id = $1
              FOR UPDATE
            `,
            [application.staff_id],
          )

          if (
            staffResult.rowCount !== 1 ||
            staffResult.rows[0].status !== 'pending'
          ) {
            await client.query('ROLLBACK')
            return error(
              response,
              409,
              'This staff account is not awaiting password setup.',
            )
          }

          const staff = staffResult.rows[0]
          const recipientEmail = String(application.email || '').trim()
          const tokenData = createStaffInvitationToken()

          await client.query(
            `
              DELETE FROM staff_invitation_tokens
              WHERE staff_id = $1
                AND consumed_at IS NULL
            `,
            [staff.id],
          )

          await client.query(
            `
              INSERT INTO staff_invitation_tokens (
                staff_id,
                application_id,
                token_hash,
                expires_at
              )
              VALUES (
                $1,
                $2,
                $3,
                CURRENT_TIMESTAMP + INTERVAL '24 hours'
              )
            `,
            [staff.id, applicationId, tokenData.tokenHash],
          )

          await client.query(
            `
              UPDATE staff_applications
              SET
                invitation_status = 'pending',
                invitation_attempts = invitation_attempts + 1,
                invitation_last_error = NULL,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `,
            [applicationId],
          )

          delivery = {
            token: tokenData.token,
            recipientEmail,
            firstName: staff.first_name,
            staffEmail: staff.email,
          }

          staffId = staff.id
          staffEmail = staff.email

          await client.query('COMMIT')
        } else {
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
                  reviewed_by_staff_id = $2,
                  reviewed_at = CURRENT_TIMESTAMP,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
              `,
              [reviewNotes, user.id, applicationId],
            )

            await client.query('COMMIT')

            try {
              await writeStaffAuditLog(
                            request,
                            user.id,
                            'staff_application.rejected',
                            'staff_application',
                            applicationId,
                            'Staff application rejected by Super Manager.',
                            { applicationId, reviewNotes },
                          )
            } catch {
              console.error('Staff application audit logging failed.')
            }

            return json(response, 200, {
              success: true,
              action,
              applicationId,
              status: 'rejected',
            })
          }

          const applicantEmail =
            typeof application.email === 'string'
              ? application.email.trim().toLowerCase()
              : ''

          if (
            !applicantEmail ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail) ||
            applicantEmail.endsWith('@northstarbank.site')
          ) {
            await client.query('ROLLBACK')
            return error(
              response,
              400,
              'The applicant must have a valid personal email address.',
            )
          }

          requestedRole =
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

          if (roleResult.rowCount !== 1 || !roleResult.rows[0].is_active) {
            await client.query('ROLLBACK')
            return error(
              response,
              400,
              'The requested management role is unavailable.',
            )
          }

          employeeNumber =
            typeof application.employee_number === 'string'
              ? application.employee_number.trim() || null
              : null

          if (employeeNumber) {
            const employeeResult = await client.query(
              `
                SELECT id
                FROM staff
                WHERE employee_number = $1
                LIMIT 1
              `,
              [employeeNumber],
            )

            if (employeeResult.rowCount !== 0) {
              await client.query('ROLLBACK')
              return error(response, 409, 'Employee number is already assigned.')
            }
          }

          const numberResult = await client.query(
            `SELECT 'STF-' || LPAD(nextval('staff_id_sequence')::text, 6, '0') AS staff_number`,
          )

          staffNumber = numberResult.rows[0].staff_number

          const slug = (value: string) =>
            value
              .normalize('NFKD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '.')
              .replace(/^\.+|\.+$/g, '')

          const namePart =
            [slug(application.first_name), slug(application.last_name)]
              .filter(Boolean)
              .join('.') || 'staff'

          staffEmail =
            `${namePart}.${staffNumber.toLowerCase()}@northstarbank.site`

          const unusablePasswordHash = await bcrypt.hash(
            randomBytes(48).toString('hex'),
            12,
          )

          const staffInsert = await client.query(
            `
              INSERT INTO staff (
                staff_number,
                first_name,
                last_name,
                email,
                phone,
                password_hash,
                status,
                employee_number,
                department,
                approved_by,
                approved_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, CURRENT_TIMESTAMP)
              RETURNING id, staff_number
            `,
            [
              staffNumber,
              application.first_name,
              application.last_name,
              staffEmail,
              application.phone ?? null,
              unusablePasswordHash,
              employeeNumber,
              application.requested_department ?? null,
              user.id,
            ],
          )

          if (staffInsert.rowCount !== 1) {
            await client.query('ROLLBACK')
            return error(response, 409, 'Unable to create the staff account.')
          }

          staffId = staffInsert.rows[0].id

          await client.query(
            `
              INSERT INTO staff_role_assignments_v2 (
                staff_id,
                role_id,
                assigned_by
              )
              VALUES ($1, $2, $3)
              ON CONFLICT (staff_id, role_id)
              DO UPDATE SET
                assigned_by = EXCLUDED.assigned_by,
                assigned_at = CURRENT_TIMESTAMP
            `,
            [staffId, roleResult.rows[0].id, user.id],
          )

          const tokenData = createStaffInvitationToken()

          await client.query(
            `
              INSERT INTO staff_invitation_tokens (
                staff_id,
                application_id,
                token_hash,
                expires_at
              )
              VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')
            `,
            [staffId, applicationId, tokenData.tokenHash],
          )

          await client.query(
            `
              UPDATE staff_applications
              SET
                status = 'approved',
                review_notes = $1,
                reviewed_by_staff_id = $2,
                reviewed_at = CURRENT_TIMESTAMP,
                staff_id = $3,
                generated_staff_email = $4,
                invitation_status = 'pending',
                invitation_attempts = invitation_attempts + 1,
                invitation_last_error = NULL,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $5
            `,
            [
              reviewNotes || null,
              user.id,
              staffId,
              staffEmail,
              applicationId,
            ],
          )

          delivery = {
            token: tokenData.token,
            recipientEmail: applicantEmail,
            firstName: application.first_name,
            staffEmail,
          }

          department = application.requested_department ?? null

          await client.query('COMMIT')

          try {
            await writeStaffAuditLog(
                        request,
                        user.id,
                        'staff_application.approved',
                        'staff_application',
                        applicationId,
                        'Staff application approved. Invitation issued for password setup.',
                        {
                          applicationId,
                          staffId,
                          staffNumber,
                          staffEmail,
                          role: requestedRole,
                          department,
                          employeeNumber,
                        },
                      )
          } catch {
            console.error('Staff application audit logging failed.')
          }
        }
      } catch (cause) {
        await client.query('ROLLBACK')
        throw cause
      } finally {
        client.release()
      }

      if (!delivery) {
        return error(response, 500, 'Unable to prepare the staff invitation.')
      }

      const sent = await deliverStaffInvitation(db, {
        applicationId,
        ...delivery,
      })

      return json(response, 200, {
        success: true,
        action,
        applicationId,
        status: 'approved',
        staffId,
        staffNumber: staffNumber || undefined,
        staffEmail,
        invitationStatus: sent ? 'sent' : 'failed',
        message: sent
          ? 'Staff account approved. The password setup invitation was emailed.'
          : 'Staff account approved, but the invitation email failed. Use Resend invitation to retry.',
        ...(action === 'approve-application'
          ? {
              role: requestedRole,
              employeeNumber,
              department,
            }
          : {}),
      })
    }

    const staffId =
      typeof request.body?.staffId === 'string'
        ? request.body.staffId.trim()
        : ''

    if (!staffId || !action) {
      return error(response, 400, 'staffId and action are required.')
    }

    if (staffId === user.id) {
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
        UPDATE staff
        SET
          status = $1,
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
          approved_by,
          approved_at,
          blocked_by,
          blocked_at,
          block_reason,
          updated_at
      `,
      [
        nextStatus,
        user.id,
        typeof request.body?.reason === 'string'
          ? request.body.reason.trim() || null
          : null,
        staffId,
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
