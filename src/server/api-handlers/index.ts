import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  res.status(200).json({
    ok: true,
    service: 'fsbank-api',
    message: 'FSBank API is online',
    timestamp: new Date().toISOString(),
  })
}
