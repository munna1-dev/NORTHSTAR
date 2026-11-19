import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'node:crypto'
import { getDb } from '../../../db/client.js'
import {
  createStaffSession,
  staffSessionCookie,
} from '../../../auth/staff-session.js'
import {
  decryptStaffMfaSecret,
  verifyStaffMfaCode,
} from '../../../auth/staff-mfa.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed.' })
  }

  const challengeToken = String(req.body?.challengeToken ?? '')
  const code = String(req.body?.code ?? '')

  if (!/^[a-f0-9]{64}$/i.test(challengeToken) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({
      ok: false,
      error: 'Enter the six-digit authenticator code.',
    })
  }

  try {
    const db = getDb()
    const tokenHash = createHash('sha256').update(challengeToken).digest('hex')

    const result = await db.query(`
      SELECT
        c.id AS challenge_id,
        c.staff_id,
        c.expires_at,
        c.attempts,
        c.consumed_at,
        s.status,
        s.two_factor_enabled,
        s.mfa_secret_encrypted
      FROM staff_mfa_challenges c
      JOIN staff s ON s.id = c.staff_id
      WHERE c.token_hash = $1
      LIMIT 1
    `, [tokenHash])

    if (result.rowCount !== 1) {
      return res.status(401).json({ ok: false, error: 'The sign-in challenge is invalid or expired.' })
    }

    const challenge = result.rows[0]

    if (
      challenge.consumed_at ||
      new Date(challenge.expires_at).getTime() <= Date.now() ||
      Number(challenge.attempts) >= 5 ||
      challenge.status !== 'active' ||
      !challenge.two_factor_enabled ||
      !challenge.mfa_secret_encrypted
    ) {
      return res.status(401).json({ ok: false, error: 'The sign-in challenge is invalid or expired.' })
    }

    const secret = decryptStaffMfaSecret(challenge.mfa_secret_encrypted)
    const valid = verifyStaffMfaCode(secret, code)

    if (!valid) {
      await db.query(`
        UPDATE staff_mfa_challenges
        SET attempts = attempts + 1
        WHERE id = $1
          AND consumed_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
          AND attempts < 5
      `, [challenge.challenge_id])

      return res.status(401).json({
        ok: false,
        error: 'The authenticator code is incorrect or expired.',
      })
    }

    // Atomically consume the challenge before creating a session.
    const consumed = await db.query(`
      UPDATE staff_mfa_challenges
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND consumed_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
        AND attempts < 5
      RETURNING staff_id
    `, [challenge.challenge_id])

    if (consumed.rowCount !== 1) {
      return res.status(401).json({
        ok: false,
        error: 'The sign-in challenge has already been used or expired.',
      })
    }

    const staffId = consumed.rows[0].staff_id

    // Recheck account status before issuing a session.
    const active = await db.query(`
      SELECT id FROM staff
      WHERE id = $1
        AND status = 'active'
        AND two_factor_enabled = TRUE
        AND mfa_secret_encrypted IS NOT NULL
    `, [staffId])

    if (active.rowCount !== 1) {
      return res.status(403).json({ ok: false, error: 'This staff account is not active.' })
    }

    const token = await createStaffSession(staffId, req)

    await db.query(`
      UPDATE staff
      SET last_login_at = CURRENT_TIMESTAMP,
          failed_login_attempts = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [staffId])

    res.setHeader('Set-Cookie', staffSessionCookie(token))
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Staff MFA verification failed:', error)
    return res.status(500).json({
      ok: false,
      error: 'Unable to verify the authenticator code at this time.',
    })
  }
}
