import type { VercelRequest } from '@vercel/node'

function firstForwardedValue(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value

  if (!raw) {
    return null
  }

  const first = raw.split(',')[0]?.trim()

  if (!first) {
    return null
  }

  if (/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(first)) {
    return first
  }

  if (first.includes(':') && /^[0-9a-fA-F:.]+$/.test(first)) {
    return first
  }

  return null
}

export function getClientIp(
  request: VercelRequest,
): string | null {
  return (
    firstForwardedValue(request.headers['x-forwarded-for']) ??
    firstForwardedValue(request.headers['x-real-ip'])
  )
}

export function getUserAgent(
  request: VercelRequest,
): string | null {
  const value = request.headers['user-agent']

  if (Array.isArray(value)) {
    return value[0]?.slice(0, 1000) ?? null
  }

  return typeof value === 'string'
    ? value.slice(0, 1000)
    : null
}

export function isStateChangingMethod(
  method: string | undefined,
): boolean {
  return (
    method === 'POST' ||
    method === 'PUT' ||
    method === 'PATCH' ||
    method === 'DELETE'
  )
}
