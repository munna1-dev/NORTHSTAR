import type { VercelRequest, VercelResponse } from '@vercel/node'

import accountApplications from '../../src/server/api-handlers/public/account-applications.js'
import staffApplications from '../../src/server/api-handlers/public/staff-applications.js'
import staffInvitations from '../../src/server/api-handlers/public/staff-invitations.js'

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

  if (resource === 'staff-applications' && parts.length === 1) {
    return staffApplications(req, res)
  }

  if (resource === 'staff-invitations' && parts.length === 1) {
    return staffInvitations(req, res)
  }

  return res.status(404).json({
    ok: false,
    error: 'Public API route not found.',
  })
}
