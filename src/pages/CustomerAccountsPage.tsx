import {
  ArrowRight,
  CreditCard,
  Landmark,
  PiggyBank,
  WalletCards,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getCustomerAccounts } from "../lib/customerApi"
import { formatCurrency } from "../lib/format"
import type { AccountType, BankAccount } from "../types"
import "./CustomerAccountsPage.css"

function accountIcon(type: AccountType) {
  switch (type) {
    case "checking":
      return <WalletCards size={21} />
    case "savings":
      return <PiggyBank size={21} />
    case "business":
      return <Landmark size={21} />
    case "credit":
      return <CreditCard size={21} />
    default:
      return <CreditCard size={21} />
  }
}

function accountLabel(type: AccountType) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function CustomerAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadAccounts() {
      try {
        const result = await getCustomerAccounts()

        if (!mounted) {
          return
        }

        setAccounts(result)
      } catch (loadError) {
        if (!mounted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your accounts.",
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadAccounts()

    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <section className="customer-accounts">
        <div className="customer-accounts__loading">
          <p>Loading your accounts…</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="customer-accounts">
        <div className="customer-accounts__error" role="alert">
          <strong>Unable to load your accounts</strong>
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
    <section className="customer-accounts">
      <header className="customer-accounts__hero">
        <div>
          <span className="customer-accounts__eyebrow">
            CUSTOMER BANKING
          </span>
          <h1>Your accounts</h1>
          <p>
            Review your NorthStarBank accounts, balances, and current
            account status.
          </p>
        </div>
      </header>

      {accounts.length === 0 ? (
        <div className="customer-accounts__empty">
          <CreditCard size={28} />
          <h2>No accounts available</h2>
          <p>
            There are no active or pending accounts associated with
            your customer profile.
          </p>
          <Link to="/open-account">
            Explore account options
            <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <div className="customer-accounts__list">
          {accounts.map((account) => (
            <article
              className="customer-accounts__card"
              key={account.id}
            >
              <div className="customer-accounts__card-top">
                <div className="customer-accounts__icon">
                  {accountIcon(account.accountType)}
                </div>

                <div>
                  <span className="customer-accounts__type">
                    {accountLabel(account.accountType)}
                  </span>
                  <h2>{account.accountNumber}</h2>
                </div>

                <span
                  className={`customer-accounts__status customer-accounts__status--${account.status}`}
                >
                  {account.status}
                </span>
              </div>

              <div className="customer-accounts__balances">
                <div>
                  <span>Available balance</span>
                  <strong>
                    {formatCurrency(
                      account.availableBalance,
                      account.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Current balance</span>
                  <strong>
                    {formatCurrency(
                      account.currentBalance,
                      account.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Currency</span>
                  <strong>{account.currency}</strong>
                </div>
              </div>

              <div className="customer-accounts__card-footer">
                <Link
                  to={`/customer/transactions?account=${encodeURIComponent(
                    account.id,
                  )}`}
                >
                  View transactions
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
