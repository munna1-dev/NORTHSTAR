import bcrypt from 'bcryptjs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getDb } from '../../src/server/db/client.js'
import { requireCustomer } from '../../src/server/auth/customer.js'
import { getSessionToken } from '../../src/server/auth/session.js'

function getIp(request: VercelRequest): string | null {
  const forwarded = request.headers['x-forwarded-for']

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || null
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0]?.trim() || null
  }

  return request.socket?.remoteAddress ?? null
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z
      .string()
      .min(12, 'New password must be at least 12 characters.')
      .max(128, 'New password must not exceed 128 characters.')
      .regex(/[A-Z]/, 'New password must contain an uppercase letter.')
      .regex(/[a-z]/, 'New password must contain a lowercase letter.')
      .regex(/[0-9]/, 'New password must contain a number.')
      .regex(
        /[^A-Za-z0-9]/,
        'New password must contain a special character.',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'New passwords do not match.',
      })
    }

    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newPassword'],
        message: 'New password must be different from your current password.',
      })
    }
  })

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    })
  }

  const customer = await requireCustomer(request)

  if (!customer) {
    return response.status(401).json({
      ok: false,
      error: 'Authentication required.',
    })
  }

  const currentToken = getSessionToken(request)

  if (!currentToken) {
    return response.status(401).json({
      ok: false,
      error: 'Active session not found.',
    })
  }

  const parsed = passwordSchema.safeParse(request.body)

  if (!parsed.success) {
    return response.status(400).json({
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        'Please check your password requirements.',
    })
  }

  const db = getDb()

  const customerResult = await db.query(
    `
      SELECT id, password_hash
      FROM customers
      WHERE id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [customer.id],
  )

  if (customerResult.rowCount !== 1) {
    return response.status(401).json({
      ok: false,
      error: 'Active customer account not found.',
    })
  }

  const account = customerResult.rows[0]

  const currentPasswordValid = await bcrypt.compare(
    parsed.data.currentPassword,
    account.password_hash,
  )

  if (!currentPasswordValid) {
    await db.query(
      `
        INSERT INTO customer_security_events (
          customer_id,
          event_type,
          ip_address,
          user_agent
        )
        VALUES ($1, 'password_change_failed', $2, $3)
      `,
      [
        customer.id,
        getIp(request),
        request.headers['user-agent'] ?? null,
      ],
    )

    return response.status(400).json({
      ok: false,
      error: 'Current password is incorrect.',
    })
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)

  const client = await db.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `
        UPDATE customers
        SET
          password_hash = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
          AND status = 'active'
      `,
      [passwordHash, customer.id],
    )

    const currentTokenHash = (
      await import('node:crypto')
    ).createHash('sha256').update(currentToken).digest('hex')

    await client.query(
      `
        DELETE FROM customer_sessions
        WHERE customer_id = $1
          AND token_hash <> $2
      `,
      [customer.id, currentTokenHash],
    )

    await client.query(
      `
        INSERT INTO customer_security_events (
          customer_id,
          event_type,
          ip_address,
          user_agent
        )
        VALUES ($1, 'password_changed', $2, $3)
      `,
      [
        customer.id,
        getIp(request),
        request.headers['user-agent'] ?? null,
      ],
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return response.status(200).json({
    ok: true,
    message:
      'Your password has been changed. Other active sessions were signed out.',
  })
}
