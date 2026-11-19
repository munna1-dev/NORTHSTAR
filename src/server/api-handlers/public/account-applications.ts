import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getDb } from '../../db/client.js'
import { getCustomerFromSession } from '../../auth/session.js'


const registrationSchema = z.object({
  accountType: z.enum(['checking', 'savings', 'business', 'credit']),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  username: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9_]{4,40}$/),
  password: z.string().min(12).max(128),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(7).max(40),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().min(2).max(100),
  stateCode: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(2).max(20),
  countryCode: z.string().trim().length(2).toUpperCase(),
  acceptedTerms: z.literal(true),
})

const applicationSchema = z.object({
  accountType: z.enum(['checking', 'savings', 'business', 'credit']),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(7).max(40),
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

  const isRegistration =
    request.body !== null &&
    typeof request.body === 'object' &&
    'username' in request.body

  if (isRegistration) {
    const registration = registrationSchema.safeParse(request.body)

    if (!registration.success) {
      return response.status(400).json({
        ok: false,
        error: 'Please check the required registration fields and password requirements.',
      })
    }

    const data = registration.data
    const email = data.email.toLowerCase()

    if (email.endsWith('@northstarbank.site')) {
      return response.status(400).json({
        ok: false,
        error: 'Please use a personal or business email address.',
      })
    }

    const birthDate = new Date(data.dateOfBirth + 'T00:00:00Z')
    const now = new Date()
    const age = now.getUTCFullYear() - birthDate.getUTCFullYear()
      - (
        now.getUTCMonth() < birthDate.getUTCMonth() ||
        (
          now.getUTCMonth() === birthDate.getUTCMonth() &&
          now.getUTCDate() < birthDate.getUTCDate()
        ) ? 1 : 0
      )

    if (
      Number.isNaN(birthDate.getTime()) ||
      birthDate.toISOString().slice(0, 10) !== data.dateOfBirth ||
      age < 18 ||
      age > 120
    ) {
      return response.status(400).json({
        ok: false,
        error: 'Applicants must be at least 18 years old and provide a valid date of birth.',
      })
    }

    const db = getDb()
    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const duplicate = await client.query(
        `SELECT 1 FROM customers
         WHERE LOWER(email) = $1 OR LOWER(username) = $2
         LIMIT 1
         FOR UPDATE`,
        [email, data.username],
      )

      if (duplicate.rowCount) {
        await client.query('ROLLBACK')
        return response.status(409).json({
          ok: false,
          error: 'That email address or username is already registered.',
        })
      }

      const passwordHash = await bcrypt.hash(data.password, 12)
      const customerNumber =
        'NSCUS' +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).slice(2, 8).toUpperCase()

      const customerResult = await client.query(
        `INSERT INTO customers
          (customer_number, first_name, last_name, username, email, phone,
           password_hash, status, role, two_factor_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'customer', false)
         RETURNING id`,
        [
          customerNumber,
          data.firstName,
          data.lastName,
          data.username,
          email,
          data.phone,
          passwordHash,
        ],
      )

      const customerId = customerResult.rows[0].id

      await client.query(
        `INSERT INTO customer_profiles
          (customer_id, date_of_birth, address_line1, address_line2,
           city, state_code, postal_code, country_code, kyc_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
        [
          customerId,
          data.dateOfBirth,
          data.addressLine1,
          data.addressLine2 || null,
          data.city,
          data.stateCode,
          data.postalCode,
          data.countryCode,
        ],
      )

      await client.query(
        `INSERT INTO customer_preferences
          (customer_id, email_alerts, transaction_alerts,
           security_alerts, marketing_emails, product_updates,
           language, currency, compact_transactions)
         VALUES ($1, true, true, true, false, true, 'English', 'USD', false)`,
        [customerId],
      )

      const applicationResult = await client.query(
        `INSERT INTO account_applications
          (customer_id, account_type, first_name, last_name,
           email, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id, account_type, status, created_at`,
        [
          customerId,
          data.accountType,
          data.firstName,
          data.lastName,
          email,
          data.phone,
        ],
      )

      await client.query('COMMIT')

      const row = applicationResult.rows[0]
      const reference = `NSA-${String(row.id)
        .replace(/-/g, '')
        .slice(0, 12)
        .toUpperCase()}`

      return response.status(201).json({
        ok: true,
        application: {
          reference,
          accountType: row.account_type,
          status: row.status,
          createdAt: row.created_at,
        },
        message: 'Registration received. Sign-in will be available after management approval.',
      })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Customer registration failed:', error)

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return response.status(409).json({
          ok: false,
          error: 'That email address or username is already registered.',
        })
      }

      return response.status(500).json({
        ok: false,
        error: 'Unable to complete registration at this time.',
      })
    } finally {
      client.release()
    }
  }

  const parsed = applicationSchema.safeParse(request.body)

  if (!parsed.success) {
    return response.status(400).json({
      ok: false,
      error: 'Please complete all required application fields.',
    })
  }

  const applicationEmail = parsed.data.email.trim().toLowerCase();

  if (applicationEmail.endsWith('@northstarbank.site')) {
    return response.status(400).json({
      ok: false,
      error: 'Please use a personal or business email address for a customer account application. NorthStarBank staff addresses are reserved for authorized staff and management.',
    });
  }

  const db = getDb()
  const customer = await getCustomerFromSession(request)

  const result = await db.query(
    `
      INSERT INTO account_applications (
        customer_id,
        account_type,
        first_name,
        last_name,
        email,
        phone,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id, account_type, status, created_at
    `,
    [
      customer?.id ?? null,
      parsed.data.accountType,
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.email,
      parsed.data.phone,
    ],
  )

  const row = result.rows[0]
  const reference = `NSA-${String(row.id)
    .replace(/-/g, '')
    .slice(0, 12)
    .toUpperCase()}`

  return response.status(201).json({
    ok: true,
    application: {
      reference,
      accountType: row.account_type,
      status: row.status,
      createdAt: row.created_at,
    },
  })
}
