import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { getDb } from '../db/client'

const SESSION_COOKIE = 'fsbank_session'
const SESSION_DAYS = 7

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function parseCookies(request: VercelRequest): Record<string, string> {
  const header = request.headers.cookie

  if (!header) {
    return {}
  }

  return Object.fromEntries(
    header.split(';').map((part) => {
      const index = part.indexOf('=')

      if (index === -1) {
        return [part.trim(), '']
      }

      const key = part.slice(0, index).trim()
      const value = part.slice(index + 1).trim()

      return [key, decodeURIComponent(value)]
    }),
  )
}

export function getSessionToken(request: VercelRequest): string | null {
  return parseCookies(request)[SESSION_COOKIE] ?? null
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
      SELECT
        c.id,
        c.customer_number,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.status,
        c.role,
        c.two_factor_enabled
      FROM customer_sessions s
      JOIN customers c
        ON c.id = s.customer_id
      WHERE s.token_hash = $1
        AND s.expires_at > CURRENT_TIMESTAMP
        AND c.status = 'active'
      LIMIT 1
    `,
    [tokenHash],
  )

  if (result.rowCount !== 1) {
    return null
  }

  await db.query(
    `
      UPDATE customer_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1
    `,
    [tokenHash],
  )

  return result.rows[0]
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
