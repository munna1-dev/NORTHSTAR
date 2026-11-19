import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { getDb } from '../../../db/client.js'
import {
  createStaffSession,
  staffSessionCookie,
} from '../../../auth/staff-session.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    })
  }

  try {
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase()

    const password = String(req.body?.password ?? '')

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Email and password are required.',
      })
    }

    if (!email.endsWith('@northstarbank.site')) {
      return res.status(403).json({
        ok: false,
        error: 'Staff sign-in requires an @northstarbank.site email address.',
      })
    }

    const db = getDb()

    const result = await db.query(
      `
        SELECT
          id,
          staff_number,
          first_name,
          last_name,
          email,
          phone,
          password_hash,
          status,
          two_factor_enabled,
          mfa_secret_encrypted,
          employee_number,
          department,
          profile_image_url,
          profile_image_path
        FROM staff
        WHERE LOWER(email) = $1
        LIMIT 1
      `,
      [email],
    )

    if (result.rowCount !== 1) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid email or password.',
      })
    }

    const staff = result.rows[0]

    if (staff.status !== 'active') {
      return res.status(403).json({
        ok: false,
        error: 'This staff account is not active.',
      })
    }

    const validPassword = await bcrypt.compare(
      password,
      staff.password_hash,
    )

    if (!validPassword) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid email or password.',
      })
    }

    if (staff.two_factor_enabled) {
      if (!staff.mfa_secret_encrypted) {
        return res.status(403).json({
          ok: false,
          error: 'MFA is enabled but its authenticator is not configured. Contact your system administrator.',
        })
      }

      const challengeToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(challengeToken).digest('hex')

      await db.query(
        `DELETE FROM staff_mfa_challenges
         WHERE staff_id = $1
           AND (expires_at <= CURRENT_TIMESTAMP OR consumed_at IS NOT NULL)`,
        [staff.id],
      )

      await db.query(
        `INSERT INTO staff_mfa_challenges (staff_id, token_hash, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '5 minutes')`,
        [staff.id, tokenHash],
      )

      return res.status(200).json({
        ok: true,
        mfaRequired: true,
        challengeToken,
      })
    }

    const token = await createStaffSession(staff.id, req)

    await db.query(
      `
        UPDATE staff
        SET last_login_at = CURRENT_TIMESTAMP,
            failed_login_attempts = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [staff.id],
    )

    res.setHeader('Set-Cookie', staffSessionCookie(token))

    return res.status(200).json({
      ok: true,
      staff: {
        id: staff.id,
        staffNumber: staff.staff_number,
        firstName: staff.first_name,
        lastName: staff.last_name,
        email: staff.email,
        phone: staff.phone,
        status: staff.status,
        twoFactorEnabled: staff.two_factor_enabled,
        employeeNumber: staff.employee_number,
        department: staff.department,
        profileImageUrl: staff.profile_image_path
          ? '/api/staff/profile-image'
          : null,
      },
    })
  } catch (error) {
    console.error('Staff login failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to sign in at this time.',
    })
  }
}
