import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireCustomer } from '../../../src/server/auth/customer'
import { getDb } from '../../../src/server/db/client'

const createBeneficiarySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Recipient name is required.')
    .max(200, 'Recipient name is too long.'),

  accountNumber: z
    .string()
    .trim()
    .min(4, 'Enter a valid account identifier.')
    .max(64, 'Account identifier is too long.'),

  institution: z
    .string()
    .trim()
    .max(200, 'Institution name is too long.')
    .optional()
    .default(''),

  routingReference: z
    .string()
    .trim()
    .max(100, 'Routing reference is too long.')
    .optional()
    .default(''),
})

function requestIp(req: VercelRequest): string | null {
  const forwarded = req.headers['x-forwarded-for']

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || null
  }

  return typeof req.socket?.remoteAddress === 'string'
    ? req.socket.remoteAddress
    : null
}

function maskAccountNumber(value: string): string {
  const normalized = value.trim()

  if (normalized.length <= 4) {
    return `•••• ${normalized}`
  }

  return `•••• ${normalized.slice(-4)}`
}

function mapBeneficiary(row: Record<string, unknown>) {
  const accountNumber = String(row.account_number ?? '')

  return {
    id: String(row.id),
    name: String(row.name),
    accountNumber: maskAccountNumber(accountNumber),
    maskedAccountNumber: maskAccountNumber(accountNumber),
    institution: String(row.bank_name ?? ''),
    status: String(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const customer = await requireCustomer(req)

  if (!customer) {
    return res.status(401).json({
      ok: false,
      authenticated: false,
      error: 'Not authenticated.',
    })
  }

  const db = getDb()

  if (req.method === 'GET') {
    const result = await db.query(
      `
        SELECT
          id,
          name,
          account_number,
          bank_name,
          status,
          created_at,
          updated_at
        FROM beneficiaries
        WHERE customer_id = $1
        ORDER BY created_at DESC
      `,
      [customer.id],
    )

    return res.status(200).json({
      ok: true,
      beneficiaries: result.rows.map(mapBeneficiary),
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    })
  }

  const parsed = createBeneficiarySchema.safeParse(req.body ?? {})

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        'Invalid beneficiary request.',
    })
  }

  const {
    name,
    accountNumber,
    institution,
    routingReference,
  } = parsed.data

  const existing = await db.query(
    `
      SELECT id
      FROM beneficiaries
      WHERE customer_id = $1
        AND account_number = $2
        AND status <> 'disabled'
      LIMIT 1
    `,
    [customer.id, accountNumber],
  )

  if (existing.rowCount === 1) {
    return res.status(409).json({
      ok: false,
      error: 'This recipient is already saved.',
    })
  }

  const result = await db.query(
    `
      INSERT INTO beneficiaries (
        customer_id,
        name,
        account_number,
        bank_name,
        routing_reference,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        NULLIF($4, ''),
        NULLIF($5, ''),
        'active'
      )
      RETURNING
        id,
        name,
        account_number,
        bank_name,
        status,
        created_at,
        updated_at
    `,
    [
      customer.id,
      name,
      accountNumber,
      institution,
      routingReference,
    ],
  )

  const beneficiary = result.rows[0]

  await db.query(
    `
      INSERT INTO audit_logs (
        actor_customer_id,
        action,
        resource_type,
        resource_id,
        description,
        ip_address,
        user_agent,
        metadata
      )
      VALUES (
        $1,
        'beneficiary.created',
        'beneficiary',
        $2,
        $3,
        $4,
        $5,
        $6
      )
    `,
    [
      customer.id,
      beneficiary.id,
      `Beneficiary ${name} was added.`,
      requestIp(req),
      req.headers['user-agent'] ?? null,
      JSON.stringify({
        institution: institution || null,
        accountLast4: accountNumber.slice(-4),
      }),
    ],
  )

  return res.status(201).json({
    ok: true,
    beneficiary: mapBeneficiary(beneficiary),
  })
}
