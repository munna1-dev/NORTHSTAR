import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

const CUSTOMER_TOKEN_KEY = 'customer_session_token'
let storageReady: Promise<void> | null = null

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

async function initializeSecureStorage(): Promise<void> {
  if (!isNativeApp()) return

  if (!storageReady) {
    storageReady = SecureStorage.setKeyPrefix('northstarbank_')
  }

  await storageReady
}

export async function getCustomerAuthorizationHeaders(): Promise<Record<string, string>> {
  if (!isNativeApp()) return {}

  await initializeSecureStorage()
  const value = await SecureStorage.get(CUSTOMER_TOKEN_KEY)

  return typeof value === 'string' && value.length > 0
    ? { Authorization: `Bearer ${value}` }
    : {}
}

export async function saveCustomerSessionToken(token: string): Promise<void> {
  if (!isNativeApp()) return
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error('The banking service returned an invalid session token.')
  }

  await initializeSecureStorage()
  await SecureStorage.set(CUSTOMER_TOKEN_KEY, token)
}

export async function clearCustomerSessionToken(): Promise<void> {
  if (!isNativeApp()) return

  await initializeSecureStorage()
  await SecureStorage.remove(CUSTOMER_TOKEN_KEY)
}
