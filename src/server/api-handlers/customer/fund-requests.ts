import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireCustomer } from '../../auth/customer.js'
import { getDb } from '../../db/client.js'

const schema = z.object({
  requestType: z.enum(['deposit', 'withdrawal']),
  accountId: z.string().uuid(),
  amount: z.string().trim()
    .regex(/^\d+(\.\d{1,2})?$/)
    .refine((value) => Number(value) > 0),
  idempotencyKey: z.string().uuid(),
  depositMethod: z.string().trim().max(80).optional(),
  depositReference: z.string().trim().max(160).optional(),
  beneficiaryName: z.string().trim().max(160).optional(),
  beneficiaryBank: z.string().trim().max(160).optional(),
  beneficiaryAccountNumber: z.string().trim().max(80).optional(),
  beneficiaryRoutingCode: z.string().trim().max(80).optional(),
  customerNote: z.string().trim().max(500).optional(),
})

function fail(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ ok: false, error })
}

function makeReference() {
  return `NS-FUND-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const customer = await requireCustomer(req)
  if (!customer) return fail(res, 401, 'Not authenticated.')

  const db = getDb()

  if (req.method === 'GET') {
    const result = await db.query(
      `SELECT id, account_id, request_type, amount, currency, status,
              reference, description, deposit_method, deposit_reference,
              beneficiary_name, beneficiary_bank,
              beneficiary_account_number, beneficiary_routing_code,
              customer_note, review_notes, settlement_reference,
              created_at, reviewed_at, completed_at
       FROM financial_requests
       WHERE customer_id = $1
         AND request_type IN ('deposit', 'withdrawal')
       ORDER BY created_at DESC
       LIMIT 100`,
      [customer.id],
    )
    return res.status(200).json({ ok: true, requests: result.rows })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return fail(res, 405, 'Method not allowed.')
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const parsed = schema.safeParse({
    ...body,
    idempotencyKey: body.idempotencyKey ?? req.headers['idempotency-key'],
  })
  if (!parsed.success) {
    return fail(res, 400, parsed.error.issues[0]?.message ?? 'Invalid request.')
  }

  const data = parsed.data

  if (data.requestType === 'withdrawal' &&
      (!data.beneficiaryName || !data.beneficiaryBank ||
       !data.beneficiaryAccountNumber)) {
    return fail(res, 400, 'Enter the beneficiary name, bank and account number.')
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const duplicate = await client.query(
      `SELECT id, request_type, amount, currency, status, reference, created_at
       FROM financial_requests
       WHERE customer_id = $1 AND idempotency_key = $2`,
      [customer.id, data.idempotencyKey],
    )
    if (duplicate.rowCount) {
      await client.query('COMMIT')
      return res.status(200).json({
        ok: true, idempotent: true, request: duplicate.rows[0],
      })
    }

    const accountResult = await client.query(
      `SELECT id, customer_id, status, currency, available_balance,
              withdrawals_blocked, withdrawal_limit
       FROM accounts
       WHERE id = $1
       FOR UPDATE`,
      [data.accountId],
    )
    if (!accountResult.rowCount) {
      await client.query('ROLLBACK')
      return fail(res, 404, 'Account not found.')
    }

    const account = accountResult.rows[0]
    if (account.customer_id !== customer.id) {
      await client.query('ROLLBACK')
      return fail(res, 403, 'You can only use your own account.')
    }
    if (account.status !== 'active') {
      await client.query('ROLLBACK')
      return fail(res, 409, 'This account is not active.')
    }

    if (data.requestType === 'withdrawal') {
      if (account.withdrawals_blocked) {
        await client.query('ROLLBACK')
        return fail(res, 409, 'Withdrawals are disabled for this account.')
      }
      if (account.withdrawal_limit !== null &&
          Number(data.amount) > Number(account.withdrawal_limit)) {
        await client.query('ROLLBACK')
        return fail(res, 409, 'The amount exceeds this account’s withdrawal limit.')
      }

      // Approved withdrawals have already been reserved from available_balance.
      // Only pending requests need to be deducted from the available amount here.
      const pending = await client.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS total
         FROM financial_requests
         WHERE account_id = $1
           AND request_type = 'withdrawal'
           AND status = 'pending'`,
        [account.id],
      )
      const sufficient = await client.query(
        `SELECT ($1::numeric + $2::numeric <= $3::numeric) AS ok`,
        [data.amount, String(pending.rows[0].total), String(account.available_balance)],
      )
      if (!sufficient.rows[0]?.ok) {
        await client.query('ROLLBACK')
        return fail(res, 409, 'The amount exceeds funds available after pending withdrawals.')
      }
    }

    const reference = makeReference()
    const description = data.customerNote || (
      data.requestType === 'deposit' ? 'Customer deposit request' : 'Customer withdrawal request'
    )

    const inserted = await client.query(
      `INSERT INTO financial_requests (
         customer_id, account_id, request_type, amount, currency,
         status, reference, idempotency_key, description,
         deposit_method, deposit_reference, beneficiary_name,
         beneficiary_bank, beneficiary_account_number,
         beneficiary_routing_code, customer_note
       ) VALUES (
         $1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
       )
       RETURNING id, account_id, request_type, amount, currency, status,
                 reference, description, deposit_method, deposit_reference,
                 beneficiary_name, beneficiary_bank, customer_note, created_at`,
      [
        customer.id, account.id, data.requestType, data.amount,
        account.currency, reference, data.idempotencyKey, description,
        data.depositMethod ?? null, data.depositReference ?? null,
        data.beneficiaryName ?? null, data.beneficiaryBank ?? null,
        data.beneficiaryAccountNumber ?? null,
        data.beneficiaryRoutingCode ?? null, data.customerNote ?? null,
      ],
    )
    const request = inserted.rows[0]

    await client.query(
      `INSERT INTO audit_logs (
         actor_customer_id, action, resource_type, resource_id,
         description, ip_address, user_agent, metadata
       ) VALUES ($1,$2,'fund_request',$3,$4,$5,$6,$7::jsonb)`,
      [
        customer.id,
        `customer.${data.requestType}.requested`,
        request.id,
        `${data.requestType} request ${request.reference} submitted.`,
        typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for'].split(',')[0].trim()
          : req.socket?.remoteAddress ?? null,
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent'] : null,
        JSON.stringify({ amount: data.amount, currency: account.currency }),
      ],
    )

    await client.query('COMMIT')
    return res.status(201).json({ ok: true, request })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* preserve original error */ }

    // A concurrent retry can win the unique idempotency constraint.
    if ((error as { code?: string })?.code === '23505') {
      const duplicate = await db.query(
        `SELECT id, request_type, amount, currency, status, reference, created_at
         FROM financial_requests
         WHERE customer_id = $1 AND idempotency_key = $2`,
        [customer.id, data.idempotencyKey],
      )
      if (duplicate.rowCount) {
        return res.status(200).json({
          ok: true, idempotent: true, request: duplicate.rows[0],
        })
      }
    }

    console.error('Fund request creation failed:', error)
    return fail(res, 500, 'Unable to submit the request.')
  } finally {
    client.release()
  }
}
