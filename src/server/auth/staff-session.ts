import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { getDb } from '../db/client.js'

const STAFF_SESSION_COOKIE = 'northstar_staff_session'
const STAFF_SESSION_DAYS = 7
const STAFF_SESSION_INACTIVITY_MINUTES = 15

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function getStaffSessionToken(request: VercelRequest): string | null {
  const cookieHeader = request.headers.cookie

  if (!cookieHeader) {
    return null
  }

  for (const rawCookie of cookieHeader.split(';')) {
    const separator = rawCookie.indexOf('=')

    if (separator < 0) {
      continue
    }

    const name = rawCookie.slice(0, separator).trim()

    if (name !== STAFF_SESSION_COOKIE) {
      continue
    }

    const value = rawCookie.slice(separator + 1).trim()

    try {
      return decodeURIComponent(value)
    } catch {
      return null
    }
  }

  return null
}

export async function createStaffSession(
  staffId: string,
  request: VercelRequest,
): Promise<string> {
  const db = getDb()

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)

  const expiresAt = new Date(
    Date.now() + STAFF_SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  await db.query(
    `
      INSERT INTO staff_sessions (
        id,
        staff_id,
        token_hash,
        user_agent,
        ip_address,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      randomUUID(),
      staffId,
      tokenHash,
      request.headers['user-agent'] ?? null,
      typeof request.headers['x-forwarded-for'] === 'string'
        ? request.headers['x-forwarded-for']
        : Array.isArray(request.headers['x-forwarded-for'])
          ? request.headers['x-forwarded-for'][0] ?? null
          : null,
      expiresAt,
    ],
  )

  return token
}

export async function getStaffFromSession(
  request: VercelRequest,
) {
  const token = getStaffSessionToken(request)

  if (!token) {
    return null
  }

  const db = getDb()
  const tokenHash = hashToken(token)

  const result = await db.query(
    `
      UPDATE staff_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1
        AND expires_at > CURRENT_TIMESTAMP
        AND last_seen_at > CURRENT_TIMESTAMP - INTERVAL '${STAFF_SESSION_INACTIVITY_MINUTES} minutes'
      RETURNING id, staff_id
    `,
    [tokenHash],
  )

  if (result.rowCount !== 1) {
    await db.query(
      `
        DELETE FROM staff_sessions
        WHERE token_hash = $1
          AND (
            expires_at <= CURRENT_TIMESTAMP
            OR last_seen_at <= CURRENT_TIMESTAMP - INTERVAL '${STAFF_SESSION_INACTIVITY_MINUTES} minutes'
          )
      `,
      [tokenHash],
    )

    return null
  }

  const staffResult = await db.query(
    `
      SELECT
        id,
        staff_number,
        first_name,
        last_name,
        email,
        phone,
        status,
        two_factor_enabled,
        employee_number,
        department,
        profile_image_url,
        profile_image_path,
        last_login_at,
        failed_login_attempts,
        login_locked_until
      FROM staff
      WHERE id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [result.rows[0].staff_id],
  )

  if (staffResult.rowCount !== 1) {
    return null
  }

  return staffResult.rows[0]
}

export async function destroyStaffSession(
  request: VercelRequest,
): Promise<void> {
  const token = getStaffSessionToken(request)

  if (!token) {
    return
  }

  const db = getDb()
  const tokenHash = hashToken(token)

  await db.query(
    `
      DELETE FROM staff_sessions
      WHERE token_hash = $1
    `,
    [tokenHash],
  )
}

export function staffSessionCookie(token: string): string {
  return [
    `${STAFF_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${STAFF_SESSION_DAYS * 24 * 60 * 60}`,
  ].join('; ')
}

export function expiredStaffSessionCookie(): string {
  return [
    `${STAFF_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ')
}
