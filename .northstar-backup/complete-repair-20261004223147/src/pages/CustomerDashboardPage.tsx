import {
  ArrowDownLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  PiggyBank,
  Plus,
  RefreshCw,
  Send,
  WalletCards,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  getCustomerAccounts,
  getCustomerProfile,
  getCustomerTransactions,
} from "../lib/customerApi"
import type {
  AccountType,
  BankAccount,
  Transaction,
  UserProfile,
} from "../types"
import "./CustomerDashboardPage.css"

type DashboardResults = [
  PromiseSettledResult<UserProfile>,
  PromiseSettledResult<BankAccount[]>,
  PromiseSettledResult<Transaction[]>,
]

function accountIcon(type: AccountType) {
  switch (type) {
    case "savings":
      return PiggyBank
    case "business":
      return Landmark
    case "credit":
      return CreditCard
    default:
      return WalletCards
  }
}

function accountLabel(type: AccountType) {
  switch (type) {
    case "checking":
      return "Checking"
    case "savings":
      return "Savings"
    case "business":
      return "Business"
    case "credit":
      return "Credit"
    default:
      return "Account"
  }
}

function transactionIcon(transaction: Transaction) {
  if (transaction.amount >= 0) {
    return ArrowDownLeft
  }

  if (transaction.type === "transfer") {
    return ArrowRightLeft
  }

  return ArrowUpRight
}

function greeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return "Good morning"
  }

  if (hour < 18) {
    return "Good afternoon"
  }

  return "Good evening"
}

function formatCurrency(
  amount: number,
  currency = "USD",
  hidden = false,
) {
  if (hidden) {
    return "••••••"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatTransactionDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function maskAccountNumber(accountNumber: string) {
  const digits = accountNumber.replace(/\s/g, "")

  if (digits.length <= 4) {
    return digits
  }

  return `•••• ${digits.slice(-4)}`
}

export function CustomerDashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [showBalances, setShowBalances] = useState(true)

  const fetchDashboardData = useCallback(
    async (): Promise<DashboardResults> => {
      const results = await Promise.allSettled([
        getCustomerProfile(),
        getCustomerAccounts(),
        getCustomerTransactions({ limit: 6 }),
      ])

      return results as DashboardResults
    },
    [],
  )

  const applyDashboardResults = useCallback(
    (results: DashboardResults) => {
      const [profileResult, accountsResult, transactionsResult] = results

      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      )

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value)
      }

      if (accountsResult.status === "fulfilled") {
        setAccounts(accountsResult.value)
      }

      if (transactionsResult.status === "fulfilled") {
        setTransactions(transactionsResult.value)
      }

      if (failures.length === 0) {
        setError("")
        return
      }

      if (failures.length === 3) {
        setError(
          "We could not load your dashboard right now. Please try again.",
        )
        return
      }

      setError(
        "Some dashboard information could not be loaded. Please try again.",
      )
    },
    [],
  )

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
      }

      try {
        const results = await fetchDashboardData()
        applyDashboardResults(results)
      } catch {
        setError(
          "We could not load your dashboard right now. Please try again.",
        )
      } finally {
        if (isRefresh) {
          setRefreshing(false)
        } else {
          setLoading(false)
        }
      }
    },
    [applyDashboardResults, fetchDashboardData],
  )

  useEffect(() => {
    let mounted = true

    const loadInitialDashboard = async () => {
      try {
        const results = await fetchDashboardData()

        if (!mounted) {
          return
        }

        applyDashboardResults(results)
      } catch {
        if (!mounted) {
          return
        }

        setError(
          "We could not load your dashboard right now. Please try again.",
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadInitialDashboard()

    return () => {
      mounted = false
    }
  }, [applyDashboardResults, fetchDashboardData])

  const totalAvailableBalance = useMemo(
    () =>
      accounts.reduce(
        (total, account) => total + Number(account.availableBalance || 0),
        0,
      ),
    [accounts],
  )

  const totalCurrentBalance = useMemo(
    () =>
      accounts.reduce(
        (total, account) => total + Number(account.currentBalance || 0),
        0,
      ),
    [accounts],
  )

  const primaryCurrency = accounts[0]?.currency ?? "USD"

  const customerName = profile?.firstName || "Customer"

  if (loading) {
    return (
      <main className="customer-dashboard">
        <section className="customer-dashboard__loading" aria-live="polite">
          <div className="customer-dashboard__loading-spinner">
            <RefreshCw size={22} aria-hidden="true" />
          </div>

          <h1>Loading your dashboard</h1>

          <p>
            We&apos;re securely retrieving your accounts and recent activity.
          </p>
        </section>
      </main>
    )
  }

  if (error && accounts.length === 0 && !profile) {
    return (
      <main className="customer-dashboard">
        <section className="customer-dashboard__error">
          <div className="customer-dashboard__error-icon">
            <RefreshCw size={22} aria-hidden="true" />
          </div>

          <div>
            <p className="customer-dashboard__eyebrow">
              NORTHSTARBANK · CUSTOMER BANKING
            </p>

            <h1>Dashboard unavailable</h1>

            <p>{error}</p>
          </div>

          <button
            type="button"
            className="customer-dashboard__primary-action"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={refreshing ? "is-spinning" : ""}
              aria-hidden="true"
            />

            {refreshing ? "Retrying…" : "Try again"}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="customer-dashboard">
      <header className="customer-dashboard__header">
        <div>
          <p className="customer-dashboard__eyebrow">
            NORTHSTARBANK · CUSTOMER BANKING
          </p>

          <h1>
            {greeting()}, {customerName}
          </h1>

          <p className="customer-dashboard__intro">
            Here&apos;s your financial overview and recent account activity.
          </p>
        </div>

        <div className="customer-dashboard__header-actions">
          <button
            type="button"
            className="customer-dashboard__refresh"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
            aria-label="Refresh dashboard"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "is-spinning" : ""}
              aria-hidden="true"
            />

            {refreshing ? "Refreshing…" : "Refresh"}
          </button>

          <Link
            to="/customer/transfer"
            className="customer-dashboard__primary-action"
          >
            <Send size={17} aria-hidden="true" />
            Transfer money
          </Link>
        </div>
      </header>

      {error && (
        <div className="customer-dashboard__notice" aria-live="polite">
          <div>
            <strong>Some information needs attention.</strong>
            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
          >
            {refreshing ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      <section className="customer-dashboard__balance-card">
        <div className="customer-dashboard__balance-main">
          <div className="customer-dashboard__balance-heading">
            <span>Total available balance</span>

            <button
              type="button"
              className="customer-dashboard__balance-toggle"
              onClick={() => setShowBalances((visible) => !visible)}
              aria-label={
                showBalances
                  ? "Hide account balances"
                  : "Show account balances"
              }
            >
              {showBalances ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          <strong className="customer-dashboard__balance-value">
            {formatCurrency(
              totalAvailableBalance,
              primaryCurrency,
              !showBalances,
            )}
          </strong>

          <p>
            Across {accounts.length}{" "}
            {accounts.length === 1 ? "account" : "accounts"}
          </p>
        </div>

        <div className="customer-dashboard__balance-meta">
          <span>Total current balance</span>

          <strong>
            {formatCurrency(
              totalCurrentBalance,
              primaryCurrency,
              !showBalances,
            )}
          </strong>
        </div>
      </section>

      <section className="customer-dashboard__quick-grid">
        <Link
          to="/customer/accounts"
          className="customer-dashboard__quick-link"
        >
          <span className="customer-dashboard__quick-icon">
            <WalletCards size={19} aria-hidden="true" />
          </span>

          <span>
            <strong>Manage accounts</strong>
            <small>View balances and details</small>
          </span>

          <ArrowRight size={17} aria-hidden="true" />
        </Link>

        <Link
          to="/customer/payments"
          className="customer-dashboard__quick-link"
        >
          <span className="customer-dashboard__quick-icon">
            <FileText size={19} aria-hidden="true" />
          </span>

          <span>
            <strong>Make a payment</strong>
            <small>Pay bills and scheduled payments</small>
          </span>

          <ArrowRight size={17} aria-hidden="true" />
        </Link>

        <Link
          to="/customer/beneficiaries"
          className="customer-dashboard__quick-link"
        >
          <span className="customer-dashboard__quick-icon">
            <Plus size={19} aria-hidden="true" />
          </span>

          <span>
            <strong>Beneficiaries</strong>
            <small>Manage transfer recipients</small>
          </span>

          <ArrowRight size={17} aria-hidden="true" />
        </Link>

        <Link
          to="/customer/security"
          className="customer-dashboard__quick-link"
        >
          <span className="customer-dashboard__quick-icon">
            <CreditCard size={19} aria-hidden="true" />
          </span>

          <span>
            <strong>Security</strong>
            <small>Review account protection</small>
          </span>

          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <section className="customer-dashboard__section">
        <div className="customer-dashboard__section-heading">
          <div>
            <p className="customer-dashboard__section-eyebrow">
              YOUR ACCOUNTS
            </p>

            <h2>Accounts</h2>
          </div>

          <Link
            to="/customer/accounts"
            className="customer-dashboard__section-link"
          >
            View all
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {accounts.length === 0 ? (
          <div className="customer-dashboard__empty">
            <WalletCards size={24} aria-hidden="true" />

            <h3>No accounts available</h3>

            <p>
              Your accounts will appear here once they are available.
            </p>
          </div>
        ) : (
          <div className="customer-dashboard__accounts">
            {accounts.map((account) => {
              const Icon = accountIcon(account.accountType)

              return (
                <Link
                  key={account.id}
                  to="/customer/accounts"
                  className="customer-dashboard__account"
                >
                  <div className="customer-dashboard__account-top">
                    <span className="customer-dashboard__account-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>

                    <span className="customer-dashboard__account-arrow">
                      <ArrowRight size={17} aria-hidden="true" />
                    </span>
                  </div>

                  <div className="customer-dashboard__account-name">
                    <strong>
                      {accountLabel(account.accountType)}
                    </strong>

                    <span>
                      {accountLabel(account.accountType)}{" "}
                      {maskAccountNumber(account.accountNumber)}
                    </span>
                  </div>

                  <div className="customer-dashboard__account-balance">
                    <span>Available balance</span>

                    <strong>
                      {formatCurrency(
                        Number(account.availableBalance || 0),
                        account.currency || primaryCurrency,
                        !showBalances,
                      )}
                    </strong>
                  </div>

                  <div className="customer-dashboard__account-status">
                    <span
                      className={`customer-dashboard__status-dot customer-dashboard__status-dot--${account.status}`}
                    />

                    {account.status}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="customer-dashboard__section">
        <div className="customer-dashboard__section-heading">
          <div>
            <p className="customer-dashboard__section-eyebrow">
              ACCOUNT ACTIVITY
            </p>

            <h2>Recent transactions</h2>
          </div>

          <Link
            to="/customer/transactions"
            className="customer-dashboard__section-link"
          >
            View all
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="customer-dashboard__empty">
            <FileText size={24} aria-hidden="true" />

            <h3>No recent transactions</h3>

            <p>
              New account activity will appear here when transactions are
              available.
            </p>
          </div>
        ) : (
          <div className="customer-dashboard__transactions">
            {transactions.map((transaction) => {
              const Icon = transactionIcon(transaction)
              const incoming = transaction.amount >= 0
              const amount = Math.abs(Number(transaction.amount || 0))

              return (
                <Link
                  key={transaction.id}
                  to="/customer/transactions"
                  className="customer-dashboard__transaction"
                >
                  <span className="customer-dashboard__transaction-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>

                  <span className="customer-dashboard__transaction-info">
                    <strong>
                      {transaction.description || "Account transaction"}
                    </strong>

                    <small>
                      {formatTransactionDate(transaction.createdAt)}
                      {transaction.reference
                        ? ` · ${transaction.reference}`
                        : ""}
                    </small>
                  </span>

                  <span
                    className={`customer-dashboard__transaction-amount ${
                      incoming ? "is-incoming" : "is-outgoing"
                    }`}
                  >
                    {incoming ? "+" : "-"}
                    {formatCurrency(
                      amount,
                      transaction.currency || primaryCurrency,
                      !showBalances,
                    )}
                  </span>

                  <ArrowRight
                    className="customer-dashboard__transaction-arrow"
                    size={16}
                    aria-hidden="true"
                  />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="customer-dashboard__footer-actions">
        <Link to="/customer/transfer">
          <Send size={17} aria-hidden="true" />
          Transfer money
        </Link>

        <Link to="/customer/accounts">
          <WalletCards size={17} aria-hidden="true" />
          View accounts
        </Link>

        <Link to="/customer/transactions">
          <FileText size={17} aria-hidden="true" />
          View transactions
        </Link>
      </section>
    </main>
  )
}
