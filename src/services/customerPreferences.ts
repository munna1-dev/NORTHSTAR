export interface CustomerPreferences {
  emailAlerts: boolean
  transactionAlerts: boolean
  securityAlerts: boolean
  marketingEmails: boolean
  productUpdates: boolean
  language: string
  currency: string
  compactTransactions: boolean
}

export const defaultCustomerPreferences: CustomerPreferences = {
  emailAlerts: true,
  transactionAlerts: true,
  securityAlerts: true,
  marketingEmails: false,
  productUpdates: true,
  language: "English",
  currency: "USD",
  compactTransactions: false,
}

const STORAGE_KEY = "fsbank.customer.preferences.v1"

function isCustomerPreferences(value: unknown): value is CustomerPreferences {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.emailAlerts === "boolean" &&
    typeof candidate.transactionAlerts === "boolean" &&
    typeof candidate.securityAlerts === "boolean" &&
    typeof candidate.marketingEmails === "boolean" &&
    typeof candidate.productUpdates === "boolean" &&
    typeof candidate.language === "string" &&
    typeof candidate.currency === "string" &&
    typeof candidate.compactTransactions === "boolean"
  )
}

export function loadCustomerPreferences(): CustomerPreferences {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return { ...defaultCustomerPreferences }
    }

    const parsed: unknown = JSON.parse(stored)

    if (!isCustomerPreferences(parsed)) {
      return { ...defaultCustomerPreferences }
    }

    return {
      ...defaultCustomerPreferences,
      ...parsed,
    }
  } catch {
    return { ...defaultCustomerPreferences }
  }
}

export function saveCustomerPreferences(
  preferences: CustomerPreferences,
): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export function resetCustomerPreferences(): CustomerPreferences {
  const defaults = { ...defaultCustomerPreferences }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))

  return defaults
}
