import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../../db/client.js'
import { getStaffFromSession } from '../../../auth/staff-session.js'
import {
  createStaffMfaEnrollment,
  encryptStaffMfaSecret,
  verifyStaffMfaCode,
} from '../../../auth/staff-mfa.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed.' })
  }

  try {
    const staff = await getStaffFromSession(req)

    if (!staff) {
      return res.status(401).json({ ok: false, error: 'Sign in before setting up MFA.' })
    }

    const db = getDb()
    const existing = await db.query(`
      SELECT email, two_factor_enabled
      FROM staff
      WHERE id = $1 AND status = 'active'
    `, [staff.id])

    if (existing.rowCount !== 1) {
      return res.status(403).json({ ok: false, error: 'This staff account is not active.' })
    }

    if (existing.rows[0].two_factor_enabled) {
      return res.status(409).json({
        ok: false,
        error: 'MFA is already enabled. Contact an authorized administrator for recovery.',
      })
    }

    const enrollment = createStaffMfaEnrollment(existing.rows[0].email)
    const encrypted = encryptStaffMfaSecret(enrollment.secret)

    await db.query(`
      UPDATE staff
      SET mfa_pending_secret_encrypted = $2,
          mfa_pending_expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'active' AND two_factor_enabled = FALSE
    `, [staff.id, encrypted])

    return res.status(200).json({
      ok: true,
      secret: enrollment.secret,
      otpauthUrl: enrollment.otpauthUrl,
      expiresInSeconds: 600,
      message: 'Add this account to your authenticator app, then confirm with its six-digit code.',
    })
  } catch (error) {
    console.error('Staff MFA enrollment setup failed:', error)
    return res.status(500).json({
      ok: false,
      error: 'Unable to start MFA enrollment. Check the server encryption-key configuration.',
    })
  }
}

export async function confirmStaffMfaEnrollment(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed.' })
  }

  const code = String(req.body?.code ?? '')

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ ok: false, error: 'Enter the six-digit authenticator code.' })
  }

  try {
    const staff = await getStaffFromSession(req)

    if (!staff) {
      return res.status(401).json({ ok: false, error: 'Sign in before confirming MFA enrollment.' })
    }

    const db = getDb()
    const result = await db.query(`
      SELECT mfa_pending_secret_encrypted
      FROM staff
      WHERE id = $1
        AND status = 'active'
        AND two_factor_enabled = FALSE
        AND mfa_pending_secret_encrypted IS NOT NULL
        AND mfa_pending_expires_at > CURRENT_TIMESTAMP
    `, [staff.id])

    if (result.rowCount !== 1) {
      return res.status(400).json({
        ok: false,
        error: 'No valid pending enrollment was found. Start setup again.',
      })
    }

    const secret = (await import('../../../auth/staff-mfa.js'))
      .decryptStaffMfaSecret(result.rows[0].mfa_pending_secret_encrypted)

    if (!verifyStaffMfaCode(secret, code)) {
      return res.status(401).json({
        ok: false,
        error: 'The authenticator code is incorrect or expired.',
      })
    }

    const activated = await db.query(`
      UPDATE staff
      SET mfa_secret_encrypted = mfa_pending_secret_encrypted,
          mfa_pending_secret_encrypted = NULL,
          mfa_pending_expires_at = NULL,
          two_factor_enabled = TRUE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status = 'active'
        AND two_factor_enabled = FALSE
        AND mfa_pending_secret_encrypted = $2
        AND mfa_pending_expires_at > CURRENT_TIMESTAMP
      RETURNING id
    `, [staff.id, result.rows[0].mfa_pending_secret_encrypted])

    if (activated.rowCount !== 1) {
      return res.status(409).json({
        ok: false,
        error: 'Enrollment changed or expired. Start setup again.',
      })
    }

    return res.status(200).json({
      ok: true,
      message: 'Multi-factor authentication is now enabled.',
    })
  } catch (error) {
    console.error('Staff MFA enrollment confirmation failed:', error)
    return res.status(500).json({
      ok: false,
      error: 'Unable to confirm MFA enrollment at this time.',
    })
  }
}
