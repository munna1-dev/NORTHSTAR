import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../src/server/db/client.js'

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const db = getDb()
    await db.query('SELECT 1')

    return res.status(200).json({
      ok: true,
      service: 'northstarbank-api',
      database: 'healthy',
      timestamp: new Date().toISOString(),
    })
  } catch {
    return res.status(503).json({
      ok: false,
      service: 'northstarbank-api',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    })
  }
}
