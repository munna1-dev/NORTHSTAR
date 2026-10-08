import type { VercelRequest, VercelResponse } from '@vercel/node'

import accountApplications from '../../src/server/api-handlers/public/account-applications.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const rawPath = req.query.path
  const parts = Array.isArray(rawPath)
    ? rawPath.filter(Boolean)
    : String(rawPath ?? '').split('/').filter(Boolean)

  if (
    parts.length === 1 &&
    parts[0] === 'account-applications'
  ) {
    return accountApplications(req, res)
  }

  return res.status(404).json({
    ok: false,
    error: 'Public API route not found.',
  })
}
