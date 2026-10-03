import type {
  BankAccount,
  BankCard,
  Beneficiary,
  CustomerNotification,
  Transaction,
  UserProfile,
} from "../types"

interface ProfileResponse {
  ok: boolean
  customer?: UserProfile
  error?: string
}

interface AccountsResponse {
  ok: boolean
  accounts?: BankAccount[]
  error?: string
}

interface TransactionsResponse {
  ok: boolean
  transactions?: Transaction[]
  error?: string
}

interface BeneficiariesResponse {
  ok: boolean
  beneficiaries?: Beneficiary[]
  beneficiary?: Beneficiary
  error?: string
}

interface TransferResponse {
  ok: boolean
  idempotent?: boolean
  transfer?: {
    id: string
    reference: string
    status: string
    amount: number
    currency: string
    fromAccountId: string
    toAccountId: string
    description: string | null
    createdAt: string
    completedAt: string | null
  }
  sourceAccount?: {
    id: string
    availableBalance: number
    currentBalance: number
  }
  error?: string
}

interface CardsResponse {
  ok: boolean
  cards?: BankCard[]
  card?: BankCard
  changed?: boolean
  error?: string
}

interface NotificationsResponse {
  ok: boolean
  notifications?: CustomerNotification[]
  unreadCount?: number
  notification?: CustomerNotification
  changed?: number
  error?: string
}


interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
}

async function request<T extends object>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? {
            "Content-Type": "application/json",
          }
        : {}),
    },
    ...(options.body !== undefined
      ? {
          body: JSON.stringify(options.body),
        }
      : {}),
  })

  const result = (await response.json()) as T

  if (!response.ok) {
    throw new Error(
      "error" in result && typeof result.error === "string"
        ? result.error
        : "Unable to complete the banking request.",
    )
  }

  return result
}

export async function getCustomerProfile(): Promise<UserProfile> {
  const result = await request<ProfileResponse>(
    "/api/customer/profile",
  )

  if (!result.ok || !result.customer) {
    throw new Error(result.error ?? "Unable to load your profile.")
  }

  return result.customer
}

export async function getCustomerAccounts(): Promise<BankAccount[]> {
  const result = await request<AccountsResponse>(
    "/api/customer/accounts",
  )

  if (!result.ok || !result.accounts) {
    throw new Error(result.error ?? "Unable to load your accounts.")
  }

  return result.accounts
}

export async function getCustomerTransactions(
  options: {
    account?: string
    search?: string
    limit?: number
  } = {},
): Promise<Transaction[]> {
  const params = new URLSearchParams()

  if (options.account) {
    params.set("account", options.account)
  }

  if (options.search) {
    params.set("search", options.search)
  }

  if (options.limit) {
    params.set("limit", String(options.limit))
  }

  const query = params.toString()

  const result = await request<TransactionsResponse>(
    `/api/customer/transactions${query ? `?${query}` : ""}`,
  )

  if (!result.ok || !result.transactions) {
    throw new Error(
      result.error ?? "Unable to load your transactions.",
    )
  }

  return result.transactions
}

export async function getCustomerCards(): Promise<BankCard[]> {
  const result = await request<CardsResponse>(
    "/api/customer/cards",
  )

  if (!result.ok || !result.cards) {
    throw new Error(
      result.error ?? "Unable to load your cards.",
    )
  }

  return result.cards
}

export async function updateCustomerCardStatus(
  id: string,
  status: "active" | "locked",
): Promise<BankCard> {
  const result = await request<CardsResponse>(
    `/api/customer/cards/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: { status },
    },
  )

  if (!result.ok || !result.card) {
    throw new Error(
      result.error ?? "Unable to update this card.",
    )
  }

  return result.card
}

export async function getCustomerBeneficiaries(): Promise<Beneficiary[]> {
  const result = await request<BeneficiariesResponse>(
    "/api/customer/beneficiaries",
  )

  if (!result.ok || !result.beneficiaries) {
    throw new Error(
      result.error ?? "Unable to load your beneficiaries.",
    )
  }

  return result.beneficiaries
}

export async function createCustomerBeneficiary(input: {
  name: string
  accountNumber: string
  institution?: string
  routingReference?: string
}): Promise<Beneficiary> {
  const result = await request<BeneficiariesResponse>(
    "/api/customer/beneficiaries",
    {
      method: "POST",
      body: input,
    },
  )

  if (!result.ok || !result.beneficiary) {
    throw new Error(
      result.error ?? "Unable to add this beneficiary.",
    )
  }

  return result.beneficiary
}

export async function updateCustomerBeneficiary(
  id: string,
  input: {
    name?: string
    accountNumber?: string
    institution?: string
    routingReference?: string
    status?: "active" | "disabled"
  },
): Promise<Beneficiary> {
  const result = await request<BeneficiariesResponse>(
    `/api/customer/beneficiaries/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: input,
    },
  )

  if (!result.ok || !result.beneficiary) {
    throw new Error(
      result.error ?? "Unable to update this beneficiary.",
    )
  }

  return result.beneficiary
}

export async function disableCustomerBeneficiary(
  id: string,
): Promise<void> {
  await request<BeneficiariesResponse>(
    `/api/customer/beneficiaries/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  )
}

export async function createCustomerTransfer(input: {
  fromAccountId: string
  toAccountId: string
  amount: string
  description?: string
  idempotencyKey: string
}): Promise<NonNullable<TransferResponse["transfer"]>> {
  const result = await request<TransferResponse>(
    "/api/customer/transfers",
    {
      method: "POST",
      body: input,
    },
  )

  if (!result.ok || !result.transfer) {
    throw new Error(
      result.error ?? "Unable to complete the transfer.",
    )
  }

  return result.transfer
}

interface PaymentResponse {
  ok: boolean
  idempotent?: boolean
  payment?: {
    id: string
    reference: string
    status: string
    payeeName: string
    payeeReference: string | null
    amount: number
    currency: string
    description: string | null
    scheduledFor: string | null
    createdAt: string
    completedAt: string | null
  }
  error?: string
}

export async function createCustomerPayment(input: {
  accountId: string
  payeeName: string
  payeeReference?: string
  amount: string
  currency: string
  scheduledFor: string
  description?: string
  idempotencyKey: string
}): Promise<NonNullable<PaymentResponse["payment"]>> {
  const result = await request<PaymentResponse>(
    "/api/customer/payments",
    {
      method: "POST",
      body: input,
    },
  )

  if (!result.ok || !result.payment) {
    throw new Error(
      result.error ?? "Unable to create the payment.",
    )
  }

  return result.payment
}

export async function getCustomerNotifications(): Promise<{
  notifications: CustomerNotification[]
  unreadCount: number
}> {
  const result = await request<NotificationsResponse>(
    "/api/customer/notifications",
  )

  if (!result.ok || !result.notifications) {
    throw new Error(
      result.error ?? "Unable to load your notifications.",
    )
  }

  return {
    notifications: result.notifications,
    unreadCount: result.unreadCount ?? 0,
  }
}

export async function markCustomerNotificationRead(
  id: string,
  isRead = true,
): Promise<CustomerNotification> {
  const result = await request<NotificationsResponse>(
    `/api/customer/notifications/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: { isRead },
    },
  )

  if (!result.ok || !result.notification) {
    throw new Error(
      result.error ?? "Unable to update this notification.",
    )
  }

  return result.notification
}

export async function markAllCustomerNotificationsRead(): Promise<number> {
  const result = await request<NotificationsResponse>(
    "/api/customer/notifications/read-all",
    {
      method: "PATCH",
    },
  )

  if (!result.ok) {
    throw new Error(
      result.error ?? "Unable to mark notifications as read.",
    )
  }

  return result.changed ?? 0
}

export interface CustomerPreferences {
  emailAlerts: boolean
  transactionAlerts: boolean
  securityAlerts: boolean
  marketingEmails: boolean
  productUpdates: boolean
  language: "English"
  currency: "USD" | "EUR" | "GBP"
  compactTransactions: boolean
  updatedAt: string | null
}

interface PreferencesResponse {
  ok: boolean
  preferences?: CustomerPreferences
  error?: string
}

export async function getCustomerPreferences(): Promise<CustomerPreferences> {
  const result = await request<PreferencesResponse>(
    "/api/customer/settings",
  )

  if (!result.ok || !result.preferences) {
    throw new Error(
      result.error ?? "Unable to load your preferences.",
    )
  }

  return result.preferences
}

export async function saveCustomerPreferences(
  preferences: Omit<CustomerPreferences, "updatedAt">,
): Promise<CustomerPreferences> {
  const result = await request<PreferencesResponse>(
    "/api/customer/settings",
    {
      method: "PUT",
      body: preferences,
    },
  )

  if (!result.ok || !result.preferences) {
    throw new Error(
      result.error ?? "Unable to save your preferences.",
    )
  }

  return result.preferences
}

export interface CustomerSupportTicket {
  id: string
  reference: string
  subject: string
  category: string
  message: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

interface SupportResponse {
  ok: boolean
  tickets?: CustomerSupportTicket[]
  ticket?: CustomerSupportTicket
  error?: string
}

export async function getCustomerSupportTickets(): Promise<
  CustomerSupportTicket[]
> {
  const result = await request<SupportResponse>(
    "/api/customer/support",
  )

  if (!result.ok || !result.tickets) {
    throw new Error(
      result.error ?? "Unable to load your support requests.",
    )
  }

  return result.tickets
}

export async function createCustomerSupportTicket(input: {
  category:
    | "Account access"
    | "Payments"
    | "Transfers"
    | "Transactions"
    | "Cards"
    | "Other"
  subject: string
  message: string
}): Promise<CustomerSupportTicket> {
  const result = await request<SupportResponse>(
    "/api/customer/support",
    {
      method: "POST",
      body: input,
    },
  )

  if (!result.ok || !result.ticket) {
    throw new Error(
      result.error ?? "Unable to create your support request.",
    )
  }

  return result.ticket
}

export interface CustomerSession {
  id: string
  device: string
  browser: string
  ipAddress: string | null
  createdAt: string
  lastActiveAt: string
  expiresAt: string
  isCurrent: boolean
}

export interface CustomerSecurityEvent {
  id: string
  type: string
  createdAt: string
  ipAddress: string | null
}

interface SecurityResponse {
  ok: boolean
  twoFactorEnabled?: boolean
  sessions?: CustomerSession[]
  securityEvents?: CustomerSecurityEvent[]
  changed?: number
  error?: string
}

export async function getCustomerSecurity(): Promise<{
  twoFactorEnabled: boolean
  sessions: CustomerSession[]
  securityEvents: CustomerSecurityEvent[]
}> {
  const result = await request<SecurityResponse>(
    "/api/customer/security",
  )

  if (!result.ok) {
    throw new Error(
      result.error ?? "Unable to load your security information.",
    )
  }

  return {
    twoFactorEnabled: result.twoFactorEnabled ?? false,
    sessions: result.sessions ?? [],
    securityEvents: result.securityEvents ?? [],
  }
}

export async function revokeCustomerSession(
  sessionId: string,
): Promise<void> {
  await request<SecurityResponse>(
    "/api/customer/security",
    {
      method: "POST",
      body: {
        action: "sign_out",
        sessionId,
      },
    },
  )
}

export async function revokeOtherCustomerSessions(): Promise<number> {
  const result = await request<SecurityResponse>(
    "/api/customer/security",
    {
      method: "POST",
      body: {
        action: "sign_out_others",
      },
    },
  )

  return result.changed ?? 0
}
