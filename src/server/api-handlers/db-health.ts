import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../db/client.js'

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
  } catch (error) {
    const err = error as {
      name?: string
      message?: string
      code?: string
      detail?: string
      hint?: string
    }

    return res.status(503).json({
      ok: false,
      service: 'northstarbank-api',
      database: 'unavailable',
      error: {
        name: err.name ?? null,
        message: err.message ?? null,
        code: err.code ?? null,
        detail: err.detail ?? null,
        hint: err.hint ?? null,
      },
      timestamp: new Date().toISOString(),
    })
  }
}
