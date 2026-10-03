import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getDb } from '../../src/server/db/client'
import { requireCustomer } from '../../src/server/auth/customer'

const preferencesSchema = z.object({
  emailAlerts: z.boolean(),
  transactionAlerts: z.boolean(),
  securityAlerts: z.boolean(),
  marketingEmails: z.boolean(),
  productUpdates: z.boolean(),
  language: z.enum(['English']),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  compactTransactions: z.boolean(),
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

  if (request.method === 'GET') {
    const result = await db.query(
      `
        SELECT
          email_alerts,
          transaction_alerts,
          security_alerts,
          marketing_emails,
          product_updates,
          language,
          currency,
          compact_transactions,
          updated_at
        FROM customer_preferences
        WHERE customer_id = $1
        LIMIT 1
      `,
      [customer.id],
    )

    const row = result.rows[0]

    return response.status(200).json({
      ok: true,
      preferences: row
        ? {
            emailAlerts: row.email_alerts,
            transactionAlerts: row.transaction_alerts,
            securityAlerts: row.security_alerts,
            marketingEmails: row.marketing_emails,
            productUpdates: row.product_updates,
            language: row.language,
            currency: row.currency,
            compactTransactions: row.compact_transactions,
            updatedAt: row.updated_at,
          }
        : {
            emailAlerts: true,
            transactionAlerts: true,
            securityAlerts: true,
            marketingEmails: false,
            productUpdates: true,
            language: 'English',
            currency: 'USD',
            compactTransactions: false,
            updatedAt: null,
          },
    })
  }

  if (request.method !== 'PUT' && request.method !== 'PATCH') {
    response.setHeader('Allow', 'GET, PUT, PATCH')
    return response.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    })
  }

  const parsed = preferencesSchema.safeParse(request.body)

  if (!parsed.success) {
    return response.status(400).json({
      ok: false,
      error: 'Invalid preference values.',
    })
  }

  const p = parsed.data

  const result = await db.query(
    `
      INSERT INTO customer_preferences (
        customer_id,
        email_alerts,
        transaction_alerts,
        security_alerts,
        marketing_emails,
        product_updates,
        language,
        currency,
        compact_transactions
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (customer_id)
      DO UPDATE SET
        email_alerts = EXCLUDED.email_alerts,
        transaction_alerts = EXCLUDED.transaction_alerts,
        security_alerts = EXCLUDED.security_alerts,
        marketing_emails = EXCLUDED.marketing_emails,
        product_updates = EXCLUDED.product_updates,
        language = EXCLUDED.language,
        currency = EXCLUDED.currency,
        compact_transactions = EXCLUDED.compact_transactions,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        email_alerts,
        transaction_alerts,
        security_alerts,
        marketing_emails,
        product_updates,
        language,
        currency,
        compact_transactions,
        updated_at
    `,
    [
      customer.id,
      p.emailAlerts,
      p.transactionAlerts,
      p.securityAlerts,
      p.marketingEmails,
      p.productUpdates,
      p.language,
      p.currency,
      p.compactTransactions,
    ],
  )

  const row = result.rows[0]

  return response.status(200).json({
    ok: true,
    preferences: {
      emailAlerts: row.email_alerts,
      transactionAlerts: row.transaction_alerts,
      securityAlerts: row.security_alerts,
      marketingEmails: row.marketing_emails,
      productUpdates: row.product_updates,
      language: row.language,
      currency: row.currency,
      compactTransactions: row.compact_transactions,
      updatedAt: row.updated_at,
    },
  })
}
