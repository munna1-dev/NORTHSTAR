import {
  ArrowRight,
  ArrowRightLeft,
  CreditCard,
  FileText,
  Plus,
  Send,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  getCustomerAccounts,
  getCustomerProfile,
  getCustomerTransactions,
} from "../lib/customerApi"
import { formatCurrency, formatDate } from "../lib/format"
import type {
  BankAccount,
  Transaction,
  UserProfile,
} from "../types"
import "./CustomerDashboardPage.css"

export function CustomerDashboardPage() {
  const [customer, setCustomer] = useState<UserProfile | null>(null)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadDashboard() {
      try {
        const [profile, customerAccounts, customerTransactions] =
          await Promise.all([
            getCustomerProfile(),
            getCustomerAccounts(),
            getCustomerTransactions({ limit: 5 }),
          ])

        if (!mounted) {
          return
        }

        setCustomer(profile)
        setAccounts(customerAccounts)
        setTransactions(customerTransactions)
      } catch (loadError) {
        if (!mounted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your banking dashboard.",
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      mounted = false
    }
  }, [])

  const totalAvailable = useMemo(
    () =>
      accounts.reduce(
        (total, account) => total + account.availableBalance,
        0,
      ),
    [accounts],
  )

  if (loading) {
    return (
      <section className="customer-dashboard">
        <div className="customer-dashboard__loading">
          <p>Loading your banking dashboard…</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="customer-dashboard">
        <div className="customer-dashboard__error" role="alert">
          <strong>Unable to load your dashboard</strong>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="customer-dashboard">
      <header className="customer-dashboard__hero">
        <div>
          <span className="customer-dashboard__eyebrow">
            CUSTOMER BANKING
          </span>
          <h1>
            Welcome back, {customer?.firstName ?? "Customer"}
          </h1>
          <p>
            Customer number{" "}
            <strong>{customer?.customerNumber}</strong>
          </p>
        </div>

        <div className="customer-dashboard__hero-actions">
          <Link to="/customer/transfer">
            <Send size={17} />
            Transfer money
          </Link>
          <Link to="/customer/accounts">
            <Plus size={17} />
            View accounts
          </Link>
        </div>
      </header>

      <div className="customer-dashboard__balance">
        <div>
          <span>Total available balance</span>
          <strong>
            {formatCurrency(
              totalAvailable,
              accounts[0]?.currency ?? "USD",
            )}
          </strong>
        </div>

        <Link to="/customer/accounts">
          View all accounts
          <ArrowRight size={17} />
        </Link>
      </div>

      <div className="customer-dashboard__grid">
        <section className="customer-dashboard__panel">
          <div className="customer-dashboard__panel-heading">
            <div>
              <span>YOUR ACCOUNTS</span>
              <h2>Accounts</h2>
            </div>
            <Link to="/customer/accounts">
              View all
              <ArrowRight size={16} />
            </Link>
          </div>

          {accounts.length === 0 ? (
            <div className="customer-dashboard__empty">
              <CreditCard size={22} />
              <p>No accounts are currently available.</p>
            </div>
          ) : (
            <div className="customer-dashboard__accounts">
              {accounts.map((account) => (
                <Link
                  className="customer-dashboard__account"
                  to="/customer/accounts"
                  key={account.id}
                >
                  <div className="customer-dashboard__account-icon">
                    <CreditCard size={19} />
                  </div>

                  <div>
                    <strong>
                      {account.accountType.charAt(0).toUpperCase() +
                        account.accountType.slice(1)}
                    </strong>
                    <span>
                      {account.accountNumber} ·{" "}
                      {account.status}
                    </span>
                  </div>

                  <div className="customer-dashboard__account-balance">
                    <strong>
                      {formatCurrency(
                        account.availableBalance,
                        account.currency,
                      )}
                    </strong>
                    <span>Available</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="customer-dashboard__panel">
          <div className="customer-dashboard__panel-heading">
            <div>
              <span>RECENT ACTIVITY</span>
              <h2>Transactions</h2>
            </div>
            <Link to="/customer/transactions">
              View all
              <ArrowRight size={16} />
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="customer-dashboard__empty">
              <FileText size={22} />
              <p>No transactions are available yet.</p>
            </div>
          ) : (
            <div className="customer-dashboard__transactions">
              {transactions.map((transaction) => (
                <div
                  className="customer-dashboard__transaction"
                  key={transaction.id}
                >
                  <div className="customer-dashboard__transaction-icon">
                    <ArrowRightLeft size={18} />
                  </div>

                  <div>
                    <strong>{transaction.description}</strong>
                    <span>
                      {formatDate(transaction.createdAt)} ·{" "}
                      {transaction.status}
                    </span>
                  </div>

                  <strong
                    className={
                      transaction.amount >= 0
                        ? "customer-dashboard__amount customer-dashboard__amount--positive"
                        : "customer-dashboard__amount"
                    }
                  >
                    {transaction.amount >= 0 ? "+" : ""}
                    {formatCurrency(
                      transaction.amount,
                      transaction.currency,
                    )}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
