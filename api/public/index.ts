import type { VercelRequest, VercelResponse } from '@vercel/node'

import accountApplications from '../../src/server/api-handlers/public/account-applications.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  const queryPath = typeof req.query.path === 'string' ? req.query.path : ''

  const parts = (queryPath || pathname)
    .replace(/^\/api\/public\/?/, '')
    .split('/')
    .filter(Boolean)

  const [resource] = parts

  if (resource === 'account-applications' && parts.length === 1) {
    return accountApplications(req, res)
  }

  return res.status(404).json({
    ok: false,
    error: 'Public API route not found.',
  })
}
