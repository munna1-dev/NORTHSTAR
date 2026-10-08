import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { requireCustomer } from '../../../src/server/auth/customer.js'
import { getDb } from '../../../src/server/db/client.js'

const updateBeneficiarySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Recipient name is required.')
    .max(200, 'Recipient name is too long.')
    .optional(),

  accountNumber: z
    .string()
    .trim()
    .min(4, 'Enter a valid account identifier.')
    .max(64, 'Account identifier is too long.')
    .optional(),

  institution: z
    .string()
    .trim()
    .max(200, 'Institution name is too long.')
    .optional(),

  routingReference: z
    .string()
    .trim()
    .max(100, 'Routing reference is too long.')
    .optional(),

  status: z
    .enum(['active', 'disabled'])
    .optional(),
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

function getId(req: VercelRequest): string | null {
  const value = req.query.id

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return typeof value === 'string' ? value : null
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

  const id = getId(req)

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: 'Beneficiary ID is required.',
    })
  }

  const db = getDb()

  if (req.method === 'PATCH') {
    const parsed = updateBeneficiarySchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          'Invalid beneficiary update.',
      })
    }

    const updates = parsed.data

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No beneficiary changes were supplied.',
      })
    }

    const existing = await db.query(
      `
        SELECT
          id,
          name,
          account_number,
          bank_name,
          routing_reference,
          status
        FROM beneficiaries
        WHERE id = $1
          AND customer_id = $2
      `,
      [id, customer.id],
    )

    if (existing.rowCount !== 1) {
      return res.status(404).json({
        ok: false,
        error: 'Beneficiary not found.',
      })
    }

    const current = existing.rows[0]

    const name =
      updates.name !== undefined
        ? updates.name
        : current.name

    const accountNumber =
      updates.accountNumber !== undefined
        ? updates.accountNumber
        : current.account_number

    const institution =
      updates.institution !== undefined
        ? updates.institution
        : current.bank_name ?? ''

    const routingReference =
      updates.routingReference !== undefined
        ? updates.routingReference
        : current.routing_reference ?? ''

    const status =
      updates.status !== undefined
        ? updates.status
        : current.status

    const duplicate = await db.query(
      `
        SELECT id
        FROM beneficiaries
        WHERE customer_id = $1
          AND account_number = $2
          AND id <> $3
          AND status <> 'disabled'
        LIMIT 1
      `,
      [customer.id, accountNumber, id],
    )

    if (duplicate.rowCount === 1) {
      return res.status(409).json({
        ok: false,
        error: 'Another saved recipient uses this account identifier.',
      })
    }

    const result = await db.query(
      `
        UPDATE beneficiaries
        SET
          name = $1,
          account_number = $2,
          bank_name = NULLIF($3, ''),
          routing_reference = NULLIF($4, ''),
          status = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
          AND customer_id = $7
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
        name,
        accountNumber,
        institution,
        routingReference,
        status,
        id,
        customer.id,
      ],
    )

    if (result.rowCount !== 1) {
      return res.status(404).json({
        ok: false,
        error: 'Beneficiary not found.',
      })
    }

    const beneficiary = result.rows[0]

    const action =
      current.status !== status
        ? status === 'disabled'
          ? 'beneficiary.disabled'
          : 'beneficiary.enabled'
        : 'beneficiary.updated'

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
          $2,
          'beneficiary',
          $3,
          $4,
          $5,
          $6,
          $7
        )
      `,
      [
        customer.id,
        action,
        beneficiary.id,
        `Beneficiary ${beneficiary.name} was ${action === 'beneficiary.disabled' ? 'disabled' : action === 'beneficiary.enabled' ? 'enabled' : 'updated'}.`,
        requestIp(req),
        req.headers['user-agent'] ?? null,
        JSON.stringify({
          accountLast4: String(accountNumber).slice(-4),
        }),
      ],
    )

    return res.status(200).json({
      ok: true,
      beneficiary: mapBeneficiary(beneficiary),
    })
  }

  if (req.method === 'DELETE') {
    const existing = await db.query(
      `
        SELECT id, name, status
        FROM beneficiaries
        WHERE id = $1
          AND customer_id = $2
      `,
      [id, customer.id],
    )

    if (existing.rowCount !== 1) {
      return res.status(404).json({
        ok: false,
        error: 'Beneficiary not found.',
      })
    }

    const beneficiary = existing.rows[0]

    if (beneficiary.status === 'disabled') {
      return res.status(200).json({
        ok: true,
        disabled: true,
      })
    }

    await db.query(
      `
        UPDATE beneficiaries
        SET
          status = 'disabled',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND customer_id = $2
      `,
      [id, customer.id],
    )

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
          'beneficiary.disabled',
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
        id,
        `Beneficiary ${beneficiary.name} was removed from active recipients.`,
        requestIp(req),
        req.headers['user-agent'] ?? null,
        JSON.stringify({
          operation: 'soft_delete',
        }),
      ],
    )

    return res.status(200).json({
      ok: true,
      disabled: true,
    })
  }

  res.setHeader('Allow', 'PATCH, DELETE')

  return res.status(405).json({
    ok: false,
    error: 'Method not allowed',
  })
}
