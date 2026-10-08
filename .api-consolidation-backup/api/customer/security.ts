import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getDb } from '../../src/server/db/client.js'
import { requireCustomer } from '../../src/server/auth/customer.js'
import { getSessionToken } from '../../src/server/auth/session.js'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function getIp(request: VercelRequest): string | null {
  const forwarded = request.headers['x-forwarded-for']

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || null
  }

  return request.socket?.remoteAddress ?? null
}

function deviceFromUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return 'Unknown device'
  }

  if (/mobile|android|iphone|ipad/i.test(userAgent)) {
    return 'Mobile device'
  }

  if (/windows/i.test(userAgent)) {
    return 'Windows device'
  }

  if (/macintosh|mac os/i.test(userAgent)) {
    return 'Mac device'
  }

  if (/linux/i.test(userAgent)) {
    return 'Linux device'
  }

  return 'Web browser'
}

function browserFromUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return 'Unknown browser'
  }

  if (/edg\//i.test(userAgent)) return 'Microsoft Edge'
  if (/chrome\//i.test(userAgent)) return 'Google Chrome'
  if (/firefox\//i.test(userAgent)) return 'Mozilla Firefox'
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) {
    return 'Safari'
  }

  return 'Web browser'
}

const sessionActionSchema = z.object({
  action: z.enum(['sign_out', 'sign_out_others']),
  sessionId: z.string().uuid().optional(),
})

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const customer = await requireCustomer(request)

  if (!customer) {
    return response.status(401).json({
      ok: false,
      error: 'Authentication required.',
    })
  }

  const db = getDb()
  const currentToken = getSessionToken(request)

  if (!currentToken) {
    return response.status(401).json({
      ok: false,
      error: 'Active session not found.',
    })
  }

  const currentHash = hashToken(currentToken)

  if (request.method === 'GET') {
    const sessionsResult = await db.query(
      `
        SELECT
          id,
          user_agent,
          ip_address,
          created_at,
          last_seen_at,
          expires_at,
          CASE
            WHEN token_hash = $1 THEN TRUE
            ELSE FALSE
          END AS is_current
        FROM customer_sessions
        WHERE customer_id = $2
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY last_seen_at DESC
      `,
      [customer.id, currentHash],
    )

    const eventsResult = await db.query(
      `
        SELECT
          id,
          event_type,
          ip_address,
          user_agent,
          created_at
        FROM customer_security_events
        WHERE customer_id = $1
        ORDER BY created_at DESC
        LIMIT 25
      `,
      [customer.id],
    )

    return response.status(200).json({
      ok: true,
      twoFactorEnabled: customer.two_factor_enabled,
      sessions: sessionsResult.rows.map((row) => ({
        id: row.id,
        device: deviceFromUserAgent(row.user_agent),
        browser: browserFromUserAgent(row.user_agent),
        ipAddress: row.ip_address,
        createdAt: row.created_at,
        lastActiveAt: row.last_seen_at,
        expiresAt: row.expires_at,
        isCurrent: row.is_current,
      })),
      securityEvents: eventsResult.rows.map((row) => ({
        id: row.id,
        type: row.event_type,
        createdAt: row.created_at,
        ipAddress: row.ip_address,
      })),
    })
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    })
  }

  const parsed = sessionActionSchema.safeParse(request.body)

  if (!parsed.success) {
    return response.status(400).json({
      ok: false,
      error: 'Invalid security action.',
    })
  }

  if (parsed.data.action === 'sign_out_others') {
    const deleted = await db.query(
      `
        DELETE FROM customer_sessions
        WHERE customer_id = $1
          AND token_hash <> $2
      `,
      [customer.id, currentHash],
    )

    await db.query(
      `
        INSERT INTO customer_security_events (
          customer_id,
          event_type,
          ip_address,
          user_agent
        )
        VALUES ($1, 'sessions_revoked', $2, $3)
      `,
      [
        customer.id,
        getIp(request),
        request.headers['user-agent'] ?? null,
      ],
    )

    return response.status(200).json({
      ok: true,
      changed: deleted.rowCount ?? 0,
    })
  }

  if (!parsed.data.sessionId) {
    return response.status(400).json({
      ok: false,
      error: 'Session ID is required.',
    })
  }

  const target = await db.query(
    `
      SELECT id, token_hash, user_agent
      FROM customer_sessions
      WHERE id = $1
        AND customer_id = $2
      LIMIT 1
    `,
    [parsed.data.sessionId, customer.id],
  )

  if (target.rowCount !== 1) {
    return response.status(404).json({
      ok: false,
      error: 'Session not found.',
    })
  }

  if (target.rows[0].token_hash === currentHash) {
    return response.status(400).json({
      ok: false,
      error: 'Use sign out to end the current session.',
    })
  }

  await db.query(
    `
      DELETE FROM customer_sessions
      WHERE id = $1
        AND customer_id = $2
    `,
    [parsed.data.sessionId, customer.id],
  )

  await db.query(
    `
      INSERT INTO customer_security_events (
        customer_id,
        event_type,
        ip_address,
        user_agent
      )
      VALUES ($1, 'session_revoked', $2, $3)
    `,
    [
      customer.id,
      getIp(request),
      request.headers['user-agent'] ?? null,
    ],
  )

  return response.status(200).json({
    ok: true,
  })
}
