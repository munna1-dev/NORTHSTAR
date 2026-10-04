import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { getDb } from '../../src/server/db/client.js'
import {
  createSession,
  sessionCookie,
} from '../../src/server/auth/session.js'

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

    const db = getDb()

    const result = await db.query(
      `
        SELECT
          id,
          customer_number,
          first_name,
          last_name,
          email,
          phone,
          password_hash,
          status,
          role,
          two_factor_enabled
        FROM customers
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

    const customer = result.rows[0]

    if (customer.status !== 'active') {
      return res.status(403).json({
        ok: false,
        error: 'This customer account is not active.',
      })
    }

    const validPassword = await bcrypt.compare(
      password,
      customer.password_hash,
    )

    if (!validPassword) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid email or password.',
      })
    }

    const token = await createSession(customer.id, req)

    await db.query(
      `
        UPDATE customers
        SET last_login_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [customer.id],
    )

    await db.query(
      `
        INSERT INTO customer_security_events (
          customer_id,
          event_type,
          ip_address,
          user_agent
        )
        VALUES ($1, 'login', $2, $3)
      `,
      [
        customer.id,
        req.headers['x-forwarded-for'] ?? null,
        req.headers['user-agent'] ?? null,
      ],
    )

    res.setHeader('Set-Cookie', sessionCookie(token))

    return res.status(200).json({
      ok: true,
      customer: {
        id: customer.id,
        customerNumber: customer.customer_number,
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        role: customer.role,
        twoFactorEnabled: customer.two_factor_enabled,
      },
    })
  } catch (error) {
    console.error('Customer login failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to sign in at this time.',
    })
  }
}
