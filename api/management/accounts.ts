import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client.js'
import { writeAuditLog } from '../../src/server/auth/audit.js'
import { requirePermission } from '../../src/server/auth/management.js'

const ACCOUNT_STATUSES = ['active', 'pending', 'frozen', 'closed'] as const

function error(response: VercelResponse, status: number, message: string) {
  return response.status(status).json({ ok: false, error: message })
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const db = getDb()

  const requestedStatus = String(request.body?.status ?? '').trim()

  if (
    request.method !== 'GET' &&
    !['active', 'frozen', 'closed'].includes(requestedStatus)
  ) {
    return error(response, 400, 'This account action is not supported.')
  }

  const managementUser =
    request.method === 'GET'
      ? await requirePermission(request, 'accounts.view')
      : await requirePermission(
          request,
          requestedStatus === 'active'
            ? 'accounts.activate'
            : requestedStatus === 'frozen'
              ? 'accounts.freeze'
              : 'accounts.close',
        )

  if (!managementUser) {
    return error(response, 403, 'You do not have permission to perform this account action.')
  }

  if (request.method === 'GET') {
    const status =
      typeof request.query.status === 'string'
        ? request.query.status.trim()
        : ''

    const search =
      typeof request.query.search === 'string'
        ? request.query.search.trim()
        : ''

    if (
      status &&
      !ACCOUNT_STATUSES.includes(
        status as typeof ACCOUNT_STATUSES[number],
      )
    ) {
      return error(response, 400, 'Invalid account status filter.')
    }

    const values: unknown[] = []
    const conditions: string[] = []

    if (status) {
      values.push(status)
      conditions.push(`a.status = $${values.length}`)
    }

    if (search) {
      values.push(`%${search}%`)
      const parameter = `$${values.length}`

      conditions.push(`
        (
          a.account_number LIKE ${parameter}
          OR c.customer_number LIKE ${parameter}
          OR c.first_name LIKE ${parameter}
          OR c.last_name LIKE ${parameter}
          OR c.email LIKE ${parameter}
        )
      `)
    }

    const where =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : ''

    const result = await db.query(
      `
        SELECT
          a.id,
          a.account_number,
          a.account_type,
          a.status,
          a.currency,
          a.available_balance,
          a.current_balance,
          a.created_at,
          a.updated_at,
          c.id AS customer_id,
          c.customer_number,
          c.first_name,
          c.last_name,
          c.email
        FROM accounts a
        INNER JOIN customers c
          ON c.id = a.customer_id
        ${where}
        ORDER BY a.created_at DESC
        LIMIT 300
      `,
      values,
    )

    return response.status(200).json({
      ok: true,
      accounts: result.rows,
    })
  }

  if (request.method === 'PATCH') {
    const body =
      typeof request.body === 'object' && request.body !== null
        ? request.body as Record<string, unknown>
        : {}

    const accountId =
      typeof body.accountId === 'string'
        ? body.accountId.trim()
        : ''

    const status =
      typeof body.status === 'string'
        ? body.status.trim()
        : ''

    if (!accountId) {
      return error(response, 400, 'Account ID is required.')
    }

    if (
      !ACCOUNT_STATUSES.includes(
        status as typeof ACCOUNT_STATUSES[number],
      )
    ) {
      return error(response, 400, 'Invalid account status.')
    }

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const accountResult = await client.query(
        `
          SELECT
            a.id,
            a.account_number,
            a.status,
            a.account_type,
            c.customer_number,
            c.role
          FROM accounts a
          INNER JOIN customers c
            ON c.id = a.customer_id
          WHERE a.id = $1
        `,
        [accountId],
      )

      if (accountResult.rowCount !== 1) {
        await client.query('ROLLBACK')
        return error(response, 404, 'Account not found.')
      }

      const account = accountResult.rows[0]

      if (
        account.role === 'management' ||
        account.role === 'developer'
      ) {
        await client.query('ROLLBACK')
        return error(
          response,
          403,
          'Management staff accounts cannot be changed through account controls.',
        )
      }

      if (account.status === 'closed' && status !== 'closed') {
        await client.query('ROLLBACK')
        return error(
          response,
          409,
          'A closed account cannot be reopened through this control.',
        )
      }

      if (account.status === status) {
        await client.query('ROLLBACK')
        return response.status(200).json({
          ok: true,
          account,
        })
      }

      const updated = await client.query(
        `
          UPDATE accounts
          SET
            status = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING
            id,
            account_number,
            account_type,
            status,
            currency,
            available_balance,
            current_balance,
            created_at,
            updated_at
        `,
        [status, accountId],
      )

      await client.query('COMMIT')

      try {
        await writeAuditLog(
          request,
          managementUser.id,
          'account.status_changed',
          'account',
          accountId,
          `Account ${account.account_number} status changed from ${account.status} to ${status}.`,
          {
            accountNumber: account.account_number,
            customerNumber: account.customer_number,
            previousStatus: account.status,
            newStatus: status,
          },
        )
      } catch (auditError) {
        console.error('Account status audit failed:', auditError)
      }

      return response.status(200).json({
        ok: true,
        account: updated.rows[0],
      })
    } catch (updateError) {
      await client.query('ROLLBACK')
      console.error('Management account update failed:', updateError)

      return error(response, 500, 'Unable to update the account.')
    } finally {
      client.release()
    }
  }

  response.setHeader('Allow', 'GET, PATCH')
  return error(response, 405, 'Method not allowed.')
}
