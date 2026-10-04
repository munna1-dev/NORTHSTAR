import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client'
import { writeAuditLog } from '../../src/server/auth/audit'
import { requirePermission, type ManagementPermission } from '../../src/server/auth/management'


function error(response: VercelResponse, status: number, message: string) {
  return response.status(status).json({ ok: false, error: message })
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const permission: ManagementPermission =
    request.method === 'GET'
      ? 'transfers.view'
      : 'transfers.view'

  const managementUser = await requirePermission(request, permission)

  if (!managementUser) {
    return error(response, 403, 'You do not have permission to access operations.')
  }

  const db = getDb()

  if (request.method === 'GET') {
    const result = await db.query(`
      SELECT
        'transfer' AS operation_type,
        t.id,
        t.status,
        t.amount,
        t.currency,
        t.description,
        t.created_at,
        a.account_number,
        c.customer_number,
        c.first_name,
        c.last_name
      FROM transfers t
      INNER JOIN accounts a
        ON a.id = t.from_account_id
      INNER JOIN customers c
        ON c.id = a.customer_id

      UNION ALL

      SELECT
        'payment' AS operation_type,
        p.id,
        p.status,
        p.amount,
        p.currency,
        p.description,
        p.created_at,
        a.account_number,
        c.customer_number,
        c.first_name,
        c.last_name
      FROM payments p
      INNER JOIN accounts a
        ON a.id = p.account_id
      INNER JOIN customers c
        ON c.id = a.customer_id

      ORDER BY created_at DESC
      LIMIT 300
    `)

    return response.status(200).json({
      ok: true,
      operations: result.rows,
    })
  }

  if (request.method === 'PATCH') {
    const body =
      typeof request.body === 'object' && request.body !== null
        ? request.body as Record<string, unknown>
        : {}

    const operationType =
      typeof body.operationType === 'string'
        ? body.operationType.trim()
        : ''

    const operationId =
      typeof body.operationId === 'string'
        ? body.operationId.trim()
        : ''

    const status =
      typeof body.status === 'string'
        ? body.status.trim()
        : ''

    if (!['transfer', 'payment'].includes(operationType)) {
      return error(response, 400, 'Invalid operation type.')
    }

    if (!operationId) {
      return error(response, 400, 'Operation ID is required.')
    }

    if (!['completed', 'failed', 'cancelled'].includes(status)) {
      return error(response, 400, 'Invalid operation status.')
    }

    const table = operationType === 'transfer' ? 'transfers' : 'payments'

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const current = await client.query(
        `
          SELECT
            id,
            status,
            amount,
            currency,
            description
          FROM ${table}
          WHERE id = $1
        `,
        [operationId],
      )

      if (current.rowCount !== 1) {
        await client.query('ROLLBACK')
        return error(response, 404, 'Operation not found.')
      }

      const operation = current.rows[0]

      if (operation.status !== 'pending') {
        await client.query('ROLLBACK')
        return error(
          response,
          409,
          'Only pending operations can be reviewed.',
        )
      }

      const updated = await client.query(
        `
          UPDATE ${table}
          SET
            status = $1
          WHERE id = $2
          RETURNING *
        `,
        [status, operationId],
      )

      await client.query('COMMIT')

      try {
        await writeAuditLog(
          request,
          managementUser.id,
          `${operationType}.status_changed`,
          operationType,
          operationId,
          `${operationType} status changed from pending to ${status}.`,
          {
            previousStatus: operation.status,
            newStatus: status,
            amount: operation.amount,
            currency: operation.currency,
          },
        )
      } catch (auditError) {
        console.error('Operation audit failed:', auditError)
      }

      return response.status(200).json({
        ok: true,
        operation: updated.rows[0],
      })
    } catch (operationError) {
      await client.query('ROLLBACK')
      console.error('Management operation update failed:', operationError)

      return error(response, 500, 'Unable to update the operation.')
    } finally {
      client.release()
    }
  }

  response.setHeader('Allow', 'GET, PATCH')
  return error(response, 405, 'Method not allowed.')
}
