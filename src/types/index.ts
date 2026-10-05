export type PortalRole =
  | 'public'
  | 'customer'
  | 'staff'
  | 'management'
  | 'developer'
  | 'super_manager'

export type AccountType =
  | 'checking'
  | 'savings'
  | 'business'
  | 'credit'

export type AccountStatus =
  | 'active'
  | 'pending'
  | 'frozen'
  | 'closed'

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'payment'
  | 'fee'
  | 'interest'
  | 'adjustment'

export type TransactionStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'reversed'

export type UserStatus =
  | 'active'
  | 'pending'
  | 'suspended'
  | 'closed'

export interface UserProfile {
  id: string
  customerNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  status: UserStatus
  role: PortalRole
  profileImageUrl?: string | null
  staffId?: string | null
  staffStatus?: string | null
  department?: string | null
  permissions?: string[]
}

export interface BankAccount {
  id: string
  accountNumber: string
  accountType: AccountType
  status: AccountStatus
  currency: string
  availableBalance: number
  currentBalance: number
}

export interface Transaction {
  id: string
  accountId: string
  reference: string
  type: TransactionType
  status: TransactionStatus
  description: string
  amount: number
  currency: string
  createdAt: string
}

export type BeneficiaryStatus =
  | 'active'
  | 'pending'
  | 'disabled'

export interface Beneficiary {
  id: string
  name: string
  accountNumber: string
  maskedAccountNumber: string
  institution: string
  status: BeneficiaryStatus
  createdAt: string
  updatedAt: string
}

export type CardStatus =
  | 'active'
  | 'locked'
  | 'expired'
  | 'cancelled'
  | 'pending'

export interface BankCard {
  id: string
  accountId: string | null
  cardType: string
  lastFour: string
  status: CardStatus
  expiryMonth: number | null
  expiryYear: number | null
  createdAt: string
  updatedAt: string
  linkedAccount: {
    accountNumber: string
    accountType: AccountType
    currency: string
    availableBalance: number
    currentBalance: number
  } | null
}

export interface NavigationItem {
  label: string
  href: string
  icon?: string
  roles?: PortalRole[]
}

export type NotificationType =
  | 'transaction'
  | 'transfer'
  | 'security'
  | 'account'

export interface CustomerNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  unread: boolean
}
