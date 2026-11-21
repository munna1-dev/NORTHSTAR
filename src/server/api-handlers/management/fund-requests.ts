import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { getDb } from '../../db/client.js'
import {
  hasManagementPermission,
  requireAnyPermission,
  type ManagementPermission,
} from '../../auth/management.js'

function fail(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ ok: false, error })
}

const viewPermissions: ManagementPermission[] = ['deposits.view', 'withdrawals.view']
const actionPermissions: ManagementPermission[] = [
  'deposits.approve', 'deposits.reject',
  'withdrawals.approve', 'withdrawals.reject',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAnyPermission(
    req, req.method === 'GET' ? viewPermissions : actionPermissions,
  )
  if (!user) return fail(res, 403, 'You do not have permission.')

  const db = getDb()

  if (req.method === 'GET') {
    const canDeposits = await hasManagementPermission(user, 'deposits.view')
    const canWithdrawals = await hasManagementPermission(user, 'withdrawals.view')
    const types = [
      ...(canDeposits ? ['deposit'] : []),
      ...(canWithdrawals ? ['withdrawal'] : []),
    ]
    if (!types.length) return fail(res, 403, 'No request-view permission.')

    const result = await db.query(
      `SELECT r.id, r.customer_id, r.account_id, r.request_type,
              r.amount, r.currency, r.status, r.reference, r.description,
              r.deposit_method, r.deposit_reference, r.beneficiary_name,
              r.beneficiary_bank, r.beneficiary_account_number,
              r.beneficiary_routing_code, r.customer_note, r.review_notes,
              r.settlement_reference, r.created_at, r.reviewed_at,
              r.completed_at, r.completed_by,
              a.account_number, a.status AS account_status,
              c.customer_number, c.first_name, c.last_name, c.email
       FROM financial_requests r
       JOIN accounts a ON a.id = r.account_id
       JOIN customers c ON c.id = r.customer_id
       WHERE r.request_type = ANY($1::text[])
       ORDER BY
         CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         r.created_at DESC
       LIMIT 300`,
      [types],
    )
    return res.status(200).json({ ok: true, requests: result.rows })
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH')
    return fail(res, 405, 'Method not allowed.')
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const action = body.action
  const reviewNote = typeof body.reviewNote === 'string'
    ? body.reviewNote.trim().slice(0, 500) : null
  const settlementReference = typeof body.settlementReference === 'string'
    ? body.settlementReference.trim().slice(0, 160) : ''

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return fail(res, 400, 'A valid request ID is required.')
  }
  if (!['approve', 'reject', 'complete'].includes(String(action))) {
    return fail(res, 400, 'Action must be approve, reject or complete.')
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const current = await client.query(
      `SELECT * FROM financial_requests
       WHERE id = $1 AND request_type IN ('deposit','withdrawal')
       FOR UPDATE`,
      [id],
    )
    if (!current.rowCount) {
      await client.query('ROLLBACK')
      return fail(res, 404, 'Fund request not found.')
    }

    const request = current.rows[0]
    const permission: ManagementPermission = request.request_type === 'deposit'
      ? action === 'reject' ? 'deposits.reject' : 'deposits.approve'
      : action === 'reject' ? 'withdrawals.reject' : 'withdrawals.approve'

    if (!(await hasManagementPermission(user, permission))) {
      await client.query('ROLLBACK')
      return fail(res, 403, 'You do not have permission for this action.')
    }

    if (action === 'approve' && request.request_type !== 'withdrawal') {
      await client.query('ROLLBACK')
      return fail(res, 409, 'Deposits must be verified and completed, not merely approved.')
    }

    if (action === 'approve' || action === 'complete') {
      const expectedStatus = action === 'approve'
        ? 'pending'
        : request.request_type === 'deposit' ? 'pending' : 'approved'

      if (request.status !== expectedStatus) {
        await client.query('ROLLBACK')
        return fail(res, 409, `This request cannot be ${action}d from its current status.`)
      }
    } else if (request.status !== 'pending' && request.status !== 'approved') {
      await client.query('ROLLBACK')
      return fail(res, 409, 'Only pending requests or reserved withdrawals can be rejected.')
    }

    const accountResult = await client.query(
      `SELECT id, customer_id, status, currency, available_balance,
              current_balance, withdrawals_blocked, withdrawal_limit
       FROM accounts
       WHERE id = $1
       FOR UPDATE`,
      [request.account_id],
    )
    if (!accountResult.rowCount) {
      await client.query('ROLLBACK')
      return fail(res, 404, 'The linked account no longer exists.')
    }

    const account = accountResult.rows[0]
    if (account.customer_id !== request.customer_id ||
        account.currency !== request.currency) {
      await client.query('ROLLBACK')
      return fail(res, 409, 'Account ownership or currency validation failed.')
    }

    let transactionId: string | null = null
    let nextStatus: string

    if (action === 'approve') {
      if (account.status !== 'active' || account.withdrawals_blocked) {
        await client.query('ROLLBACK')
        return fail(res, 409, 'This account cannot currently process withdrawals.')
      }
      if (account.withdrawal_limit !== null &&
          Number(request.amount) > Number(account.withdrawal_limit)) {
        await client.query('ROLLBACK')
        return fail(res, 409, 'The request exceeds the account withdrawal limit.')
      }

      const reserved = await client.query(
        `UPDATE accounts
         SET available_balance = available_balance - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND available_balance >= $1`,
        [request.amount, account.id],
      )
      if (reserved.rowCount !== 1) {
        await client.query('ROLLBACK')
        return fail(res, 409, 'Insufficient available balance to reserve this withdrawal.')
      }

      nextStatus = 'approved'
      const approved = await client.query(
        `UPDATE financial_requests
         SET status = 'approved', review_notes = $1,
             reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND status = 'pending' RETURNING id`,
        [reviewNote, user.id, id],
      )
      if (approved.rowCount !== 1) throw new Error('Withdrawal request changed during approval.')
    } else if (action === 'reject') {
      if (request.status === 'approved') {
        if (request.request_type !== 'withdrawal') {
          await client.query('ROLLBACK')
          return fail(res, 409, 'Only an approved withdrawal can release a reservation.')
        }
        const released = await client.query(
          `UPDATE accounts
           SET available_balance = available_balance + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [request.amount, account.id],
        )
        if (released.rowCount !== 1) {
          throw new Error('Unable to release the reserved withdrawal amount.')
        }
      }

      nextStatus = 'rejected'
      const rejected = await client.query(
        `UPDATE financial_requests
         SET status = 'rejected', review_notes = $1,
             reviewed_by = COALESCE(reviewed_by, $2),
             reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND status = $4 RETURNING id`,
        [reviewNote, user.id, id, request.status],
      )
      if (rejected.rowCount !== 1) throw new Error('Fund request changed during rejection.')
    } else {
      if (!settlementReference) {
        await client.query('ROLLBACK')
        return fail(res, 400, 'A verified deposit receipt or external payout reference is required.')
      }
      if (account.status !== 'active') {
        await client.query('ROLLBACK')
        return fail(res, 409, 'The linked account is not active.')
      }

      if (request.request_type === 'deposit') {
        // Staff completion represents confirmation that the funds were actually received.
        const credited = await client.query(
          `UPDATE accounts
           SET available_balance = available_balance + $1,
               current_balance = current_balance + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 RETURNING id`,
          [request.amount, account.id],
        )
        if (credited.rowCount !== 1) throw new Error('Unable to credit the deposit account.')
      } else {
        // Approval already reserved available funds. Settlement reduces the ledger balance.
        const settled = await client.query(
          `UPDATE accounts
           SET current_balance = current_balance - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND current_balance >= $1`,
          [request.amount, account.id],
        )
        if (settled.rowCount !== 1) {
          await client.query('ROLLBACK')
          return fail(res, 409, 'The account balance cannot cover this withdrawal settlement.')
        }
      }

      transactionId = randomUUID()
      const transactionReference =
        `NS-TXN-${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`
      const signedAmount = request.request_type === 'withdrawal'
        ? `-${request.amount}` : String(request.amount)

      await client.query(
        `INSERT INTO transactions (
           id, account_id, reference, transaction_type, status,
           description, amount, currency, metadata
         ) VALUES ($1,$2,$3,$4,'completed',$5,$6,$7,$8::jsonb)`,
        [
          transactionId, account.id, transactionReference,
          request.request_type,
          `${request.request_type} request ${request.reference} settled`,
          signedAmount, request.currency,
          JSON.stringify({
            fundRequestId: request.id,
            fundRequestReference: request.reference,
            settlementReference,
            completedByStaffId: user.id,
          }),
        ],
      )

      nextStatus = 'completed'
      const completed = await client.query(
        `UPDATE financial_requests
         SET status = 'completed',
             settlement_reference = $1,
             completed_by = $2,
             completed_at = CURRENT_TIMESTAMP,
             review_notes = COALESCE($3, review_notes),
             reviewed_by = COALESCE(reviewed_by, $2),
             reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND status = $5 RETURNING id`,
        [
          settlementReference, user.id, reviewNote, id,
          request.request_type === 'deposit' ? 'pending' : 'approved',
        ],
      )
      if (completed.rowCount !== 1) throw new Error('Fund request changed during settlement.')
    }

    await client.query(
      `INSERT INTO audit_logs (
         actor_customer_id, action, resource_type, resource_id,
         description, metadata
       ) VALUES (
         NULL, $1, 'fund_request', $2, $3, $4::jsonb
       )`,
      [
        `${request.request_type}.${action}`,
        id,
        `${request.request_type} request ${request.reference}: ${action}.`,
        JSON.stringify({
          actorStaffId: user.id,
          amount: String(request.amount),
          currency: request.currency,
          settlementReference: settlementReference || null,
          transactionId,
          resultingStatus: nextStatus,
        }),
      ],
    )

    await client.query('COMMIT')
    return res.status(200).json({
      ok: true, requestId: id, status: nextStatus, transactionId,
    })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* preserve original error */ }
    console.error('Fund request action failed:', error)
    return fail(res, 500, 'Unable to process this fund request.')
  } finally {
    client.release()
  }
}
