import type {
  BankAccount,
  Transaction,
  UserProfile,
} from '../types'

export const demoUser: UserProfile = {
  id: 'usr_demo_001',
  customerNumber: 'FS10002481',
  firstName: 'Jordan',
  lastName: 'Morgan',
  email: 'jordan.morgan@example.com',
  phone: '+1 (555) 010-2481',
  status: 'active',
  role: 'customer',
}

export const demoAccounts: BankAccount[] = [
  {
    id: 'acct_demo_001',
    accountNumber: '•••• 4821',
    accountType: 'checking',
    status: 'active',
    currency: 'USD',
    availableBalance: 8420.65,
    currentBalance: 8670.65,
  },
  {
    id: 'acct_demo_002',
    accountNumber: '•••• 9137',
    accountType: 'savings',
    status: 'active',
    currency: 'USD',
    availableBalance: 15480.25,
    currentBalance: 15480.25,
  },
]

export const demoTransactions: Transaction[] = [
  {
    id: 'txn_demo_001',
    accountId: 'acct_demo_001',
    reference: 'FS-TXN-104821',
    type: 'deposit',
    status: 'completed',
    description: 'Payroll Deposit',
    amount: 3250.00,
    currency: 'USD',
    createdAt: '2026-09-29T14:30:00Z',
  },
  {
    id: 'txn_demo_002',
    accountId: 'acct_demo_001',
    reference: 'FS-TXN-104822',
    type: 'payment',
    status: 'completed',
    description: 'Utility Payment',
    amount: -185.40,
    currency: 'USD',
    createdAt: '2026-09-28T16:10:00Z',
  },
  {
    id: 'txn_demo_003',
    accountId: 'acct_demo_001',
    reference: 'FS-TXN-104823',
    type: 'transfer',
    status: 'completed',
    description: 'Transfer to Savings',
    amount: -500.00,
    currency: 'USD',
    createdAt: '2026-09-27T11:45:00Z',
  },
  {
    id: 'txn_demo_004',
    accountId: 'acct_demo_002',
    reference: 'FS-TXN-104824',
    type: 'interest',
    status: 'completed',
    description: 'Monthly Interest',
    amount: 42.18,
    currency: 'USD',
    createdAt: '2026-09-26T09:00:00Z',
  },
]
