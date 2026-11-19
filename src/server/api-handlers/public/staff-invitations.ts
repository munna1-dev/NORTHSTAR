import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'
import { getDb } from '../../db/client.js'

function reply(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function validPassword(password: string) {
  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (!['GET', 'POST'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, POST')
    return reply(res, 405, { error: 'Method not allowed.' })
  }

  const token =
    typeof req.query.token === 'string'
      ? req.query.token.trim()
      : typeof req.body?.token === 'string'
        ? req.body.token.trim()
        : ''

  if (!token || token.length > 200) {
    return reply(res, 400, { error: 'A valid invitation token is required.' })
  }

  const hash = tokenHash(token)
  const db = getDb()

  try {
    if (req.method === 'GET') {
      const result = await db.query(
        `
          SELECT
            s.first_name,
            s.last_name,
            s.email
          FROM staff_invitation_tokens t
          JOIN staff s ON s.id = t.staff_id
          JOIN staff_applications a ON a.id = t.application_id
          WHERE t.token_hash = $1
            AND t.consumed_at IS NULL
            AND t.expires_at > CURRENT_TIMESTAMP
            AND s.status = 'pending'
            AND a.status = 'approved'
            AND a.invitation_status IN ('pending', 'sent')
          LIMIT 1
        `,
        [hash],
      )

      if (result.rowCount !== 1) {
        return reply(res, 400, {
          valid: false,
          error: 'This invitation is invalid, expired, or already used.',
        })
      }

      return reply(res, 200, {
        valid: true,
        staff: {
          firstName: result.rows[0].first_name,
          lastName: result.rows[0].last_name,
          email: result.rows[0].email,
        },
      })
    }

    const password =
      typeof req.body?.password === 'string'
        ? req.body.password
        : ''

    if (!validPassword(password)) {
      return reply(res, 400, {
        error:
          'Use 12–128 characters with uppercase, lowercase, a number, and a symbol.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const invitation = await client.query(
        `
          SELECT
            t.id AS token_id,
            t.staff_id,
            t.application_id
          FROM staff_invitation_tokens t
          JOIN staff s ON s.id = t.staff_id
          JOIN staff_applications a ON a.id = t.application_id
          WHERE t.token_hash = $1
            AND t.consumed_at IS NULL
            AND t.expires_at > CURRENT_TIMESTAMP
            AND s.status = 'pending'
            AND a.status = 'approved'
            AND a.invitation_status IN ('pending', 'sent')
          FOR UPDATE OF t, s, a
        `,
        [hash],
      )

      if (invitation.rowCount !== 1) {
        await client.query('ROLLBACK')
        return reply(res, 400, {
          error: 'This invitation is invalid, expired, or already used.',
        })
      }

      const row = invitation.rows[0]

      const activated = await client.query(
        `
          UPDATE staff
          SET
            password_hash = $1,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND status = 'pending'
          RETURNING id
        `,
        [passwordHash, row.staff_id],
      )

      if (activated.rowCount !== 1) {
        await client.query('ROLLBACK')
        return reply(res, 409, {
          error: 'This staff account cannot be activated.',
        })
      }

      await client.query(
        `
          UPDATE staff_invitation_tokens
          SET consumed_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [row.token_id],
      )

      await client.query(
        `
          UPDATE staff_applications
          SET
            invitation_status = 'completed',
            invitation_last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [row.application_id],
      )

      await client.query('COMMIT')

      return reply(res, 200, {
        success: true,
        message: 'Your staff password has been created. You can now sign in.',
      })
    } catch (cause) {
      await client.query('ROLLBACK')
      throw cause
    } finally {
      client.release()
    }
  } catch (cause) {
    console.error('Staff invitation setup failed:', cause)
    return reply(res, 500, {
      error: 'Unable to complete staff registration. Please try again.',
    })
  }
}
