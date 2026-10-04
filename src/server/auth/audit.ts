import { randomUUID } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { getDb } from '../db/client'

function getClientIp(request: VercelRequest): string | null {
  const forwarded = request.headers['x-forwarded-for']

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim() || null
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0] ?? null
  }

  return request.socket?.remoteAddress ?? null
}

export async function writeAuditLog(
  request: VercelRequest,
  actorCustomerId: string,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const db = getDb()

  await db.query(
    `
      INSERT INTO audit_logs (
        id,
        actor_customer_id,
        action,
        resource_type,
        resource_id,
        description,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      randomUUID(),
      actorCustomerId,
      action,
      resourceType,
      resourceId,
      description,
      getClientIp(request),
      request.headers['user-agent'] ?? null,
      JSON.stringify(metadata),
    ],
  )
}
