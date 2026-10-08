import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  res.status(200).json({
    ok: true,
    service: 'northstarbank-api',
    status: 'healthy',
    environment: process.env.NODE_ENV ?? 'production',
    timestamp: new Date().toISOString(),
  })
}
