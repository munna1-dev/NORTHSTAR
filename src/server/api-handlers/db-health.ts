import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requirePermission } from '../auth/management.js'
import { getDb } from '../db/client.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    })
  }

  let user

  try {
    user = await requirePermission(req, 'dashboard.view')
  } catch (error) {
    console.error('Database health authorization check failed:', error)
    return res.status(503).json({
      ok: false,
      error: 'Health check temporarily unavailable.',
    })
  }

  if (!user) {
    return res.status(403).json({
      ok: false,
      error: 'You do not have permission to view database health.',
    })
  }

  try {
    await getDb().query('SELECT 1')

    return res.status(200).json({
      ok: true,
      service: 'northstarbank-api',
      database: 'healthy',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Database health query failed:', error)

    return res.status(503).json({
      ok: false,
      service: 'northstarbank-api',
      database: 'unavailable',
      error: 'Database health check failed.',
      timestamp: new Date().toISOString(),
    })
  }
}
