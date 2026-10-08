import type { VercelRequest, VercelResponse } from '@vercel/node'

import customerLogin from '../../src/server/api-handlers/auth/login.js'
import customerLogout from '../../src/server/api-handlers/auth/logout.js'
import customerMe from '../../src/server/api-handlers/auth/me.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  const queryPath = typeof req.query.path === 'string' ? req.query.path : ''

  const parts = (queryPath || pathname)
    .replace(/^\/api\/auth\/?/, '')
    .split('/')
    .filter(Boolean)

  const [resource] = parts

  if (resource === 'login' && parts.length === 1) {
    return customerLogin(req, res)
  }

  if (resource === 'logout' && parts.length === 1) {
    return customerLogout(req, res)
  }

  if (resource === 'me' && parts.length === 1) {
    return customerMe(req, res)
  }

  return res.status(404).json({
    ok: false,
    error: 'Authentication API route not found.',
  })
}
