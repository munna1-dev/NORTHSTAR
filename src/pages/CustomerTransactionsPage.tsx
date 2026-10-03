import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Search,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  getCustomerAccounts,
  getCustomerTransactions,
} from "../lib/customerApi"
import { formatCurrency, formatDateTime } from "../lib/format"
import type { BankAccount, Transaction } from "../types"
import "./CustomerTransactionsPage.css"

function transactionIcon(transaction: Transaction) {
  if (transaction.amount > 0) {
    return <ArrowDownLeft size={18} />
  }

  if (transaction.type === "transfer") {
    return <ArrowRightLeft size={18} />
  }

  return <ArrowUpRight size={18} />
}

function transactionTypeLabel(type: Transaction["type"]) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function CustomerTransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState(
    searchParams.get("search") ?? "",
  )
  const [accountFilter, setAccountFilter] = useState(
    searchParams.get("account") ?? "",
  )
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
      }
    }

    void loadAccounts()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadTransactions() {
      setLoading(true)
      setError("")

      try {
        const result = await getCustomerTransactions({
          account: accountFilter || undefined,
          search: search.trim() || undefined,
          limit: 200,
        })

        if (!mounted) {
          return
        }

        setTransactions(result)
      } catch (loadError) {
        if (!mounted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your transactions.",
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadTransactions()

    return () => {
      mounted = false
    }
  }, [accountFilter, search])

  const accountNames = useMemo(() => {
    return new Map(
      accounts.map((account) => [account.id, account]),
    )
  }, [accounts])

  function updateAccountFilter(value: string) {
    setAccountFilter(value)

    const next = new URLSearchParams(searchParams)

    if (value) {
      next.set("account", value)
    } else {
      next.delete("account")
    }

    setSearchParams(next, { replace: true })
  }

  function updateSearch(value: string) {
    setSearch(value)

    const next = new URLSearchParams(searchParams)

    if (value.trim()) {
      next.set("search", value)
    } else {
      next.delete("search")
    }

    setSearchParams(next, { replace: true })
  }

  return (
    <section className="customer-transactions">
      <header className="customer-transactions__hero">
        <div>
          <span className="customer-transactions__eyebrow">
            CUSTOMER BANKING
          </span>
          <h1>Transactions</h1>
          <p>
            Review account activity and search your NorthStarBank
            transaction history.
          </p>
        </div>
      </header>

      <section className="customer-transactions__filters">
        <label>
          <span>Account</span>
          <select
            value={accountFilter}
            onChange={(event) =>
              updateAccountFilter(event.target.value)
            }
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.accountType.charAt(0).toUpperCase() +
                  account.accountType.slice(1)}{" "}
                · {account.accountNumber}
              </option>
            ))}
          </select>
        </label>

        <label className="customer-transactions__search">
          <span>Search</span>
          <div>
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                updateSearch(event.target.value)
              }
              placeholder="Search transactions"
              aria-label="Search transactions"
            />
          </div>
        </label>
      </section>

      {error ? (
        <div className="customer-transactions__error" role="alert">
          <strong>Unable to load transactions</strong>
          <p>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="customer-transactions__loading">
          <p>Loading your transactions…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="customer-transactions__empty">
          <ArrowRightLeft size={28} />
          <h2>No transactions found</h2>
          <p>
            Try changing your account or search filters.
          </p>
        </div>
      ) : (
        <section className="customer-transactions__list">
          <div className="customer-transactions__list-heading">
            <span>{transactions.length} transactions</span>
          </div>

          {transactions.map((transaction) => {
            const account = accountNames.get(transaction.accountId)

            return (
              <article
                className="customer-transactions__row"
                key={transaction.id}
              >
                <div className="customer-transactions__icon">
                  {transactionIcon(transaction)}
                </div>

                <div className="customer-transactions__details">
                  <strong>{transaction.description}</strong>
                  <span>
                    {transactionTypeLabel(transaction.type)} ·{" "}
                    {transaction.status}
                  </span>
                  <small>
                    {formatDateTime(transaction.createdAt)}
                    {account
                      ? ` · ${account.accountNumber}`
                      : ""}
                  </small>
                </div>

                <div
                  className={`customer-transactions__amount${
                    transaction.amount >= 0
                      ? " customer-transactions__amount--positive"
                      : ""
                  }`}
                >
                  {transaction.amount >= 0 ? "+" : ""}
                  {formatCurrency(
                    transaction.amount,
                    transaction.currency,
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}

      <div className="customer-transactions__footer">
        <Link to="/customer/accounts">
          Back to accounts
        </Link>
      </div>
    </section>
  )
}
