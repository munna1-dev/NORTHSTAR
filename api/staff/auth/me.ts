import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getStaffFromSession } from '../../../src/server/auth/staff-session.js'
import { query } from '../../../src/server/db/client.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    })
  }

  try {
    const staff = await getStaffFromSession(req)

    if (!staff) {
      return res.status(401).json({
        ok: false,
        authenticated: false,
        error: 'Not authenticated.',
      })
    }

    const result = await query<{
      role: string | null
      permissions: string[]
    }>(
      `
        SELECT
          (
            SELECT mr.role_key
            FROM staff_role_assignments_v2 sra
            JOIN management_roles mr
              ON mr.id = sra.role_id
            WHERE sra.staff_id = $1
              AND mr.is_active = TRUE
            ORDER BY sra.assigned_at DESC
            LIMIT 1
          ) AS role,
          COALESCE(
            (
              SELECT ARRAY_AGG(mp.permission_key ORDER BY mp.permission_key)
              FROM management_permissions mp
              WHERE (
                  EXISTS (
                    SELECT 1
                    FROM staff_role_assignments_v2 sra
                    JOIN management_role_permissions mrp
                      ON mrp.role_id = sra.role_id
                    WHERE sra.staff_id = $1
                      AND mrp.permission_id = mp.id
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM staff_permission_assignments_v2 spa
                    WHERE spa.staff_id = $1
                      AND spa.permission_id = mp.id
                      AND spa.effect = 'allow'
                  )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM staff_permission_assignments_v2 spa
                  WHERE spa.staff_id = $1
                    AND spa.permission_id = mp.id
                    AND spa.effect = 'deny'
                )
            ),
            ARRAY[]::text[]
          ) AS permissions
      `,
      [staff.id],
    )

    const management = result.rows[0]

    return res.status(200).json({
      ok: true,
      authenticated: true,
      staff: {
        id: staff.id,
        staffNumber: staff.staff_number,
        firstName: staff.first_name,
        lastName: staff.last_name,
        email: staff.email,
        phone: staff.phone,
        status: staff.status,
        role: management?.role ?? 'staff',
        twoFactorEnabled: staff.two_factor_enabled,
        employeeNumber: staff.employee_number,
        staffId: staff.id,
        staffStatus: staff.status,
        department: staff.department,
        permissions: management?.permissions ?? [],
        profileImageUrl: staff.profile_image_path
          ? '/api/staff/profile-image'
          : null,
      },
    })
  } catch (error) {
    console.error('Staff session lookup failed:', error)

    return res.status(500).json({
      ok: false,
      authenticated: false,
      error: 'Unable to verify the staff session.',
    })
  }
}
