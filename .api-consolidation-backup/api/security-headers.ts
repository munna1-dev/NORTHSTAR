import type { VercelResponse } from '@vercel/node'

export function applySecurityHeaders(
  res: VercelResponse,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader(
    'Referrer-Policy',
    'strict-origin-when-cross-origin',
  )
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  )
}
