import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { getDb } from '../db/client.js'

const SESSION_COOKIE = 'northstar_session'
const LEGACY_SESSION_COOKIE = 'fsbank_session'
const SESSION_DAYS = 7
export const SESSION_INACTIVITY_MINUTES = 15

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function getSessionToken(request: VercelRequest): string | null {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(';')

  for (const rawCookie of cookies) {
    const separator = rawCookie.indexOf('=')
    if (separator < 0) continue

    const name = rawCookie.slice(0, separator).trim()
    const value = rawCookie.slice(separator + 1).trim()

    if (
      name !== SESSION_COOKIE &&
      name !== LEGACY_SESSION_COOKIE
    ) {
      continue
    }

    try {
      return decodeURIComponent(value)
    } catch {
      return null
    }
  }

  return null
}

export async function createSession(
  customerId: string,
  request: VercelRequest,
): Promise<string> {
  const db = getDb()

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  await db.query(
    `
      INSERT INTO customer_sessions (
        id,
        customer_id,
        token_hash,
        user_agent,
        ip_address,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
    `,
    [
      randomUUID(),
      customerId,
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

export async function getCustomerFromSession(
  request: VercelRequest,
) {
  const token = getSessionToken(request)

  if (!token) {
    return null
  }

  const db = getDb()
  const tokenHash = hashToken(token)

  const result = await db.query(
    `
      UPDATE customer_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1
        AND expires_at > CURRENT_TIMESTAMP
        AND last_seen_at > CURRENT_TIMESTAMP - INTERVAL '${SESSION_INACTIVITY_MINUTES} minutes'
      RETURNING id, customer_id
    `,
    [tokenHash],
  )

  if (result.rowCount !== 1) {
    await db.query(
      `
        DELETE FROM customer_sessions
        WHERE token_hash = $1
          AND (
            expires_at <= CURRENT_TIMESTAMP
            OR last_seen_at <= CURRENT_TIMESTAMP - INTERVAL '${SESSION_INACTIVITY_MINUTES} minutes'
          )
      `,
      [tokenHash],
    )

    return null
  }

  const customerResult = await db.query(
    `
      SELECT
        id,
        customer_number,
        first_name,
        last_name,
        email,
        phone,
        status,
        role,
        two_factor_enabled,
        profile_image_url,
        profile_image_path
      FROM customers
      WHERE id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [result.rows[0].customer_id],
  )

  if (customerResult.rowCount !== 1) {
    return null
  }

  return customerResult.rows[0]
}

export async function destroySession(
  request: VercelRequest,
): Promise<void> {
  const token = getSessionToken(request)

  if (!token) {
    return
  }

  const db = getDb()
  const tokenHash = hashToken(token)

  await db.query(
    `
      DELETE FROM customer_sessions
      WHERE token_hash = $1
    `,
    [tokenHash],
  )
}

export function sessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ].join('; ')
}

export function expiredSessionCookie(): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ')
}

export function expiredLegacySessionCookie(): string {
  return [
    `${LEGACY_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ')
}
