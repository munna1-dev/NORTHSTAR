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

    if (response.status === 401) {
      window.dispatchEvent(
        new CustomEvent('northstar:auth-unauthorized'),
      )
    }

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
  identifier: string,
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
        identifier,
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

export interface StaffProfile {
  id: string
  staffNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  status: string
  role: string
  twoFactorEnabled: boolean
  staffStatus: string | null
  staffId: string
  department: string | null
  permissions: string[]
}

interface StaffAuthMeResponse {
  ok: boolean
  authenticated: boolean
  staff?: StaffProfile
  error?: string
}

interface StaffAuthResponse {
  ok: boolean
  staff?: StaffProfile
  error?: string
  mfaRequired?: boolean
  challengeToken?: string
}

export async function getCurrentStaff(): Promise<StaffProfile | null> {
  try {
    const response = await fetch('/api/staff/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })

    if (response.status === 401) {
      window.dispatchEvent(
        new CustomEvent('northstar:staff-unauthorized'),
      )
    }

    if (!response.ok) {
      return null
    }

    const result = (await response.json()) as StaffAuthMeResponse

    if (!result.ok || !result.authenticated || !result.staff) {
      return null
    }

    return result.staff
  } catch {
    return null
  }
}

export async function signInStaff(
  email: string,
  password: string,
): Promise<StaffAuthResponse> {
  try {
    const response = await fetch('/api/staff/auth/login', {
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

    const result = (await response.json()) as StaffAuthResponse

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

export async function signOutStaff(): Promise<void> {
  try {
    await fetch('/api/staff/auth/logout', {
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


export async function verifyStaffMfa(
  challengeToken: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/staff/auth/verify-mfa', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ challengeToken, code }),
    })

    const result = await response.json() as { ok: boolean; error?: string }
    return response.ok && result.ok
      ? { ok: true }
      : { ok: false, error: result.error ?? 'Authenticator verification failed.' }
  } catch {
    return { ok: false, error: 'Unable to connect to the banking service.' }
  }
}
