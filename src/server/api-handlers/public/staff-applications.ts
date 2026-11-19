import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getDb } from '../../db/client.js'

const applicationSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(7).max(40),
  department: z.string().trim().min(2).max(100),
  requestedRole: z.string().trim().min(2).max(80),
  applicationNotes: z.string().trim().max(2000).optional().default(''),
  website: z.string().optional().default(''),
})

function reply(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method === 'GET') {
    try {
      const result = await getDb().query(`
        SELECT role_key, role_name, description
        FROM management_roles
        WHERE is_active = true
          AND role_key <> 'super_manager'
        ORDER BY role_name
      `)

      return reply(res, 200, { roles: result.rows })
    } catch (cause) {
      console.error('Unable to load staff application roles:', cause)
      return reply(res, 500, {
        error: 'Unable to load application options.',
      })
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return reply(res, 405, { error: 'Method not allowed.' })
  }

  const parsed = applicationSchema.safeParse(req.body)

  if (!parsed.success) {
    return reply(res, 400, {
      error: 'Please complete all required fields with valid information.',
    })
  }

  const data = parsed.data

  // Quietly accept honeypot submissions without storing them.
  if (data.website.trim()) {
    return reply(res, 201, {
      success: true,
      message: 'Your application has been received.',
    })
  }

  const email = data.email.toLowerCase()

  if (email.endsWith('@northstarbank.site')) {
    return reply(res, 400, {
      error: 'Use a personal email address where we can contact you.',
    })
  }

  const db = getDb()

  try {
    const role = await db.query(
      `SELECT role_key FROM management_roles
       WHERE role_key = $1 AND is_active = true
         AND role_key <> 'super_manager'
       LIMIT 1`,
      [data.requestedRole],
    )

    if (role.rowCount !== 1) {
      return reply(res, 400, {
        error: 'Please select a valid available staff role.',
      })
    }

    const duplicate = await db.query(
      `SELECT id FROM staff_applications
       WHERE LOWER(email) = $1
         AND status IN ('pending', 'approved')
       LIMIT 1`,
      [email],
    )

    if (duplicate.rowCount) {
      return reply(res, 409, {
        error: 'An application for this email address is already being processed.',
      })
    }

    const result = await db.query(
      `INSERT INTO staff_applications (
        customer_id,
        first_name,
        last_name,
        email,
        phone,
        requested_department,
        requested_role,
        application_notes,
        status
      )
      VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING id, status, created_at`,
      [
        data.firstName,
        data.lastName,
        email,
        data.phone,
        data.department,
        data.requestedRole,
        data.applicationNotes || null,
      ],
    )

    const row = result.rows[0]
    const reference = `NSA-${String(row.id)
      .replace(/-/g, '')
      .slice(0, 12)
      .toUpperCase()}`

    return reply(res, 201, {
      success: true,
      application: {
        reference,
        status: row.status,
        createdAt: row.created_at,
      },
      message: 'Your staff application has been submitted for management review.',
    })
  } catch (cause) {
    console.error('Staff application submission failed:', cause)
    return reply(res, 500, {
      error: 'Unable to submit your application at this time. Please try again later.',
    })
  }
}
