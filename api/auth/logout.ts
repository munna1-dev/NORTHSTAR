import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  destroySession,
  expiredSessionCookie,
} from '../../src/server/auth/session.js'

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
    await destroySession(req)

    res.setHeader('Set-Cookie', expiredSessionCookie())

    return res.status(200).json({
      ok: true,
    })
  } catch (error) {
    console.error('Logout failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to sign out.',
    })
  }
}
