import type { UserProfile } from '../types'

interface AuthMeResponse {
  ok: boolean
  authenticated: boolean
  customer?: UserProfile
  error?: string
}

export async function getCurrentCustomer(): Promise<UserProfile | null> {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const result = (await response.json()) as AuthMeResponse

    if (!result.ok || !result.authenticated || !result.customer) {
      return null
    }

    return result.customer
  } catch {
    return null
  }
}

export async function signInCustomer(
  email: string,
  password: string,
): Promise<{
  ok: boolean
  customer?: UserProfile
  error?: string
}> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })

    const result = (await response.json()) as {
      ok: boolean
      customer?: UserProfile
      error?: string
    }

    if (!response.ok || !result.ok) {
      return {
        ok: false,
        error: result.error ?? 'Unable to sign in.',
      }
    }

    return result
  } catch {
    return {
      ok: false,
      error: 'Unable to connect to the banking service.',
    }
  }
}

export async function signOutCustomer(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })
  } catch {
    // The server session may already be unavailable.
  }
}
