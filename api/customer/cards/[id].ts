import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireCustomer } from '../../../src/server/auth/customer.js'
import { getDb } from '../../../src/server/db/client.js'

const ALLOWED_STATUS = new Set(['active', 'locked'])

function getRequestIp(request: VercelRequest): string | null {
  const forwarded = request.headers['x-forwarded-for']

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0] ?? null
  }

  return null
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    })
  }

  const cardId =
    typeof req.query.id === 'string'
      ? req.query.id.trim()
      : ''

  if (!cardId) {
    return res.status(400).json({
      ok: false,
      error: 'Card ID is required.',
    })
  }

  try {
    const customer = await requireCustomer(req)

    if (!customer) {
      return res.status(401).json({
        ok: false,
        authenticated: false,
        error: 'Not authenticated.',
      })
    }

    const requestedStatus =
      typeof req.body?.status === 'string'
        ? req.body.status.trim().toLowerCase()
        : ''

    if (!ALLOWED_STATUS.has(requestedStatus)) {
      return res.status(400).json({
        ok: false,
        error: 'Card status must be active or locked.',
      })
    }

    const db = getDb()
    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const cardResult = await client.query(
        `
          SELECT
            id,
            customer_id,
            card_type,
            last_four,
            status,
            expiry_month,
            expiry_year,
            account_id
          FROM cards
          WHERE id = $1
            AND customer_id = $2
          FOR UPDATE
        `,
        [cardId, customer.id],
      )

      if (cardResult.rowCount !== 1) {
        await client.query('ROLLBACK')

        return res.status(404).json({
          ok: false,
          error: 'Card not found.',
        })
      }

      const card = cardResult.rows[0]

      if (!ALLOWED_STATUS.has(card.status)) {
        await client.query('ROLLBACK')

        return res.status(409).json({
          ok: false,
          error: 'This card cannot be locked or unlocked.',
        })
      }

      if (card.status === requestedStatus) {
        await client.query('COMMIT')

        return res.status(200).json({
          ok: true,
          card: {
            id: card.id,
            cardType: card.card_type,
            lastFour: card.last_four,
            status: card.status,
            expiryMonth: card.expiry_month,
            expiryYear: card.expiry_year,
            accountId: card.account_id,
          },
          changed: false,
        })
      }

      const updatedResult = await client.query(
        `
          UPDATE cards
          SET
            status = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND customer_id = $3
          RETURNING
            id,
            card_type,
            last_four,
            status,
            expiry_month,
            expiry_year,
            account_id,
            created_at,
            updated_at
        `,
        [requestedStatus, cardId, customer.id],
      )

      const updated = updatedResult.rows[0]

      await client.query(
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
            'card',
            $3,
            $4,
            $5,
            $6,
            $7
          )
        `,
        [
          customer.id,
          requestedStatus === 'locked'
            ? 'customer.card.lock'
            : 'customer.card.unlock',
          cardId,
          requestedStatus === 'locked'
            ? 'Customer locked a card.'
            : 'Customer unlocked a card.',
          getRequestIp(req),
          req.headers['user-agent'] ?? null,
          JSON.stringify({
            previousStatus: card.status,
            newStatus: requestedStatus,
            lastFour: card.last_four,
          }),
        ],
      )

      await client.query('COMMIT')

      return res.status(200).json({
        ok: true,
        changed: true,
        card: {
          id: updated.id,
          cardType: updated.card_type,
          lastFour: updated.last_four,
          status: updated.status,
          expiryMonth: updated.expiry_month,
          expiryYear: updated.expiry_year,
          accountId: updated.account_id,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Customer card update failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to update the card.',
    })
  }
}
