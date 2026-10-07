import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  destroyStaffSession,
  expiredStaffSessionCookie,
} from '../../../src/server/auth/staff-session.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    })
  }

  try {
    await destroyStaffSession(req)

    res.setHeader(
      'Set-Cookie',
      expiredStaffSessionCookie(),
    )

    return res.status(200).json({
      ok: true,
    })
  } catch (error) {
    console.error('Staff logout failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to sign out.',
    })
  }
}
