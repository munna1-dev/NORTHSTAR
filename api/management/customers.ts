import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client'
import { writeAuditLog } from '../../src/server/auth/audit'
import { requireManagement } from '../../src/server/auth/management'

const CUSTOMER_STATUSES = ['active', 'pending', 'suspended', 'closed'] as const

function sendError(
  response: VercelResponse,
  status: number,
  error: string,
) {
  return response.status(status).json({
    ok: false,
    error,
  })
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const managementUser = await requireManagement(request)

  if (!managementUser) {
    return sendError(response, 401, 'Management authentication required.')
  }

  const db = getDb()

  if (request.method === 'GET') {
    const status =
      typeof request.query.status === 'string'
        ? request.query.status.trim()
        : ''

    const search =
      typeof request.query.search === 'string'
        ? request.query.search.trim()
        : ''

    if (status && !CUSTOMER_STATUSES.includes(status as typeof CUSTOMER_STATUSES[number])) {
      return sendError(response, 400, 'Invalid customer status filter.')
    }

    const values: unknown[] = []
    const conditions: string[] = []

    if (status) {
      values.push(status)
      conditions.push(`c.status = $${values.length}`)
    }

    if (search) {
      values.push(`%${search}%`)
      const parameter = `$${values.length}`

      conditions.push(`
        (
          c.customer_number LIKE ${parameter}
          OR c.first_name LIKE ${parameter}
          OR c.last_name LIKE ${parameter}
          OR c.email LIKE ${parameter}
          OR COALESCE(c.phone, '') LIKE ${parameter}
        )
      `)
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : ''

    const result = await db.query(
      `
        SELECT
          c.id,
          c.customer_number,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          c.status,
          c.role,
          c.two_factor_enabled,
          c.last_login_at,
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT a.id) AS account_count,
          COALESCE(
            SUM(
              CASE
                WHEN a.status <> 'closed'
                THEN a.current_balance
                ELSE 0
              END
            ),
            0
          ) AS total_balance
        FROM customers c
        LEFT JOIN accounts a
          ON a.customer_id = c.id
        ${whereClause}
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT 200
      `,
      values,
    )

    return response.status(200).json({
      ok: true,
      customers: result.rows,
    })
  }

  if (request.method === 'PATCH') {
    const body =
      typeof request.body === 'object' && request.body !== null
        ? request.body as Record<string, unknown>
        : {}

    const customerId =
      typeof body.customerId === 'string'
        ? body.customerId.trim()
        : ''

    const status =
      typeof body.status === 'string'
        ? body.status.trim()
        : ''

    if (!customerId) {
      return sendError(response, 400, 'Customer ID is required.')
    }

    if (!CUSTOMER_STATUSES.includes(status as typeof CUSTOMER_STATUSES[number])) {
      return sendError(response, 400, 'Invalid customer status.')
    }

    if (status === 'pending') {
      return sendError(
        response,
        400,
        'Management cannot manually move a customer back to pending.',
      )
    }

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const customerResult = await client.query(
        `
          SELECT
            id,
            customer_number,
            first_name,
            last_name,
            email,
            status,
            role
          FROM customers
          WHERE id = ?
        `,
        [customerId],
      )

      if (customerResult.rowCount !== 1) {
        await client.query('ROLLBACK')
        return sendError(response, 404, 'Customer not found.')
      }

      const customer = customerResult.rows[0]

      if (customer.role === 'management' || customer.role === 'developer') {
        await client.query('ROLLBACK')
        return sendError(
          response,
          403,
          'Management staff accounts cannot be changed through customer controls.',
        )
      }

      if (customer.status === status) {
        await client.query('ROLLBACK')

        return response.status(200).json({
          ok: true,
          customer: {
            ...customer,
            status,
          },
        })
      }

      if (customer.status === 'closed') {
        await client.query('ROLLBACK')
        return sendError(
          response,
          409,
          'A closed customer account cannot be reopened through this control.',
        )
      }

      if (status === 'closed') {
        await client.query(
          `
            UPDATE accounts
            SET
              status = 'closed',
              updated_at = CURRENT_TIMESTAMP
            WHERE customer_id = ?
              AND status <> 'closed'
          `,
          [customerId],
        )
      }

      const updatedResult = await client.query(
        `
          UPDATE customers
          SET
            status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          RETURNING
            id,
            customer_number,
            first_name,
            last_name,
            email,
            phone,
            status,
            role,
            two_factor_enabled,
            last_login_at,
            created_at,
            updated_at
        `,
        [status, customerId],
      )

      await client.query('COMMIT')

      try {
        await writeAuditLog(
          request,
          managementUser.id,
          'customer.status_changed',
          'customer',
          customerId,
          `Customer ${customer.customer_number} status changed from ${customer.status} to ${status}.`,
          {
            customerNumber: customer.customer_number,
            previousStatus: customer.status,
            newStatus: status,
          },
        )
      } catch (auditError) {
        console.error('Customer status audit failed:', auditError)
      }

      return response.status(200).json({
        ok: true,
        customer: updatedResult.rows[0],
      })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Management customer update failed:', error)

      return sendError(
        response,
        500,
        'Unable to update the customer.',
      )
    } finally {
      client.release()
    }
  }

  response.setHeader('Allow', 'GET, PATCH')
  return sendError(response, 405, 'Method not allowed.')
}
