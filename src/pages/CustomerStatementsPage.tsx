import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  FileText,
  Printer,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  getCustomerAccounts,
  getCustomerTransactions,
} from "../lib/customerApi"
import { formatCurrency } from "../lib/format"
import type { BankAccount, Transaction } from "../types"
import "./CustomerStatementsPage.css"

interface Statement {
  id: string
  accountId: string
  period: string
  startDate: string
  endDate: string
  openingBalance: number
  closingBalance: number
  deposits: number
  withdrawals: number
  transactionCount: number
  currency: string
  transactions: Transaction[]
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`))
}

function getMonthKey(date: string) {
  const value = new Date(date)

  if (Number.isNaN(value.getTime())) {
    return ""
  }

  return `${value.getUTCFullYear()}-${String(
    value.getUTCMonth() + 1,
  ).padStart(2, "0")}`
}

function getMonthStart(monthKey: string) {
  return `${monthKey}-01`
}

function getMonthEnd(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return `${monthKey}-${String(lastDay).padStart(2, "0")}`
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function isCreditTransaction(transaction: Transaction) {
  return (
    transaction.type === "deposit" ||
    transaction.type === "interest" ||
    (transaction.type === "adjustment" && transaction.amount > 0)
  )
}

function getAccountLabel(account: BankAccount) {
  const type =
    account.accountType.charAt(0).toUpperCase() +
    account.accountType.slice(1)

  return `${type} • ${account.accountNumber}`
}

function getOpeningBalance(
  account: BankAccount,
  statementTransactions: Transaction[],
) {
  if (statementTransactions.length === 0) {
    return account.currentBalance
  }

  const netMovement = statementTransactions.reduce((total, transaction) => {
    const amount = Math.abs(transaction.amount)

    return isCreditTransaction(transaction)
      ? total + amount
      : total - amount
  }, 0)

  return account.currentBalance - netMovement
}

export function CustomerStatementsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accountId, setAccountId] = useState("all")
  const [selectedStatement, setSelectedStatement] =
    useState<Statement | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  async function loadStatements(showRefreshState = false) {
    try {
      if (showRefreshState) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const [accountResult, transactionResult] = await Promise.all([
        getCustomerAccounts(),
        getCustomerTransactions({ limit: 200 }),
      ])

      setAccounts(accountResult)
      setTransactions(transactionResult)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your statements.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError("")

        const [accountResult, transactionResult] = await Promise.all([
          getCustomerAccounts(),
          getCustomerTransactions({ limit: 200 }),
        ])

        if (cancelled) {
          return
        }

        setAccounts(accountResult)
        setTransactions(transactionResult)
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your statements.",
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => account.status !== "closed"),
    [accounts],
  )

  const statements = useMemo(() => {
    const accountIds =
      accountId === "all"
        ? new Set(visibleAccounts.map((account) => account.id))
        : new Set([accountId])

    const relevantTransactions = transactions.filter(
      (transaction) =>
        accountIds.has(transaction.accountId) &&
        transaction.status !== "failed",
    )

    const groups = new Map<string, Transaction[]>()

    for (const transaction of relevantTransactions) {
      const monthKey = getMonthKey(transaction.createdAt)

      if (!monthKey) {
        continue
      }

      const key = `${transaction.accountId}:${monthKey}`
      const existing = groups.get(key) ?? []

      existing.push(transaction)
      groups.set(key, existing)
    }

    const result: Statement[] = []

    for (const [key, statementTransactions] of groups) {
      const [statementAccountId, monthKey] = key.split(":")
      const account = accounts.find(
        (item) => item.id === statementAccountId,
      )

      if (!account) {
        continue
      }

      const orderedTransactions = [...statementTransactions].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime(),
      )

      const deposits = orderedTransactions.reduce(
        (total, transaction) =>
          isCreditTransaction(transaction)
            ? total + Math.abs(transaction.amount)
            : total,
        0,
      )

      const withdrawals = orderedTransactions.reduce(
        (total, transaction) =>
          isCreditTransaction(transaction)
            ? total
            : total + Math.abs(transaction.amount),
        0,
      )

      const openingBalance = getOpeningBalance(
        account,
        orderedTransactions,
      )

      const closingBalance =
        openingBalance + deposits - withdrawals

      result.push({
        id: `${statementAccountId}-${monthKey}`,
        accountId: statementAccountId,
        period: formatMonth(monthKey),
        startDate: getMonthStart(monthKey),
        endDate: getMonthEnd(monthKey),
        openingBalance,
        closingBalance,
        deposits,
        withdrawals,
        transactionCount: orderedTransactions.length,
        currency: account.currency,
        transactions: orderedTransactions,
      })
    }

    return result.sort(
      (a, b) =>
        new Date(b.startDate).getTime() -
        new Date(a.startDate).getTime(),
    )
  }, [accountId, accounts, transactions, visibleAccounts])

  function handlePrint() {
    window.print()
  }

  return (
    <main className="statements-page">
      <div className="statements-page__topbar">
        <Link to="/customer" className="statements-page__back">
          <ArrowLeft size={17} />
          Back to dashboard
        </Link>
      </div>

      <header className="statements-page__header">
        <div>
          <span className="statements-page__kicker">
            DOCUMENT CENTER
          </span>
          <h1>Statements &amp; documents</h1>
          <p>
            Review account activity grouped into statement periods from
            your authenticated transaction ledger.
          </p>
        </div>

        <div
          className="statements-page__header-icon"
          aria-hidden="true"
        >
          <FileText size={25} />
        </div>
      </header>

      <section className="statements-page__notice">
        <ShieldCheck size={20} />
        <div>
          <strong>Secure account activity</strong>
          <span>
            Statement information is loaded from your authenticated
            accounts and transaction records. Only accounts belonging to
            your customer profile are returned by the banking API.
          </span>
        </div>
      </section>

      {error ? (
        <section className="statements-page__notice" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>Unable to load statements</strong>
            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() => void loadStatements(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "is-spinning" : ""}
            />
            Retry
          </button>
        </section>
      ) : null}

      <section
        className="statements-page__controls"
        aria-label="Statement filters"
      >
        <div className="statements-page__field">
          <label htmlFor="statement-account">Account</label>

          <div className="statements-page__select-wrap">
            <select
              id="statement-account"
              value={accountId}
              onChange={(event) => {
                setAccountId(event.target.value)
                setSelectedStatement(null)
              }}
              disabled={loading}
            >
              <option value="all">All accounts</option>

              {visibleAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {getAccountLabel(account)}
                </option>
              ))}
            </select>

            <ChevronDown size={17} aria-hidden="true" />
          </div>
        </div>

        <div className="statements-page__result-count">
          <CalendarDays size={17} />
          <span>
            {loading
              ? "Loading statement activity…"
              : `${statements.length} statement${
                  statements.length === 1 ? "" : "s"
                } available`}
          </span>
        </div>
      </section>

      {loading ? (
        <section className="statements-empty" aria-live="polite">
          <RefreshCw size={28} className="is-spinning" />
          <h2>Loading statements</h2>
          <p>
            Securely retrieving your account and transaction activity.
          </p>
        </section>
      ) : selectedStatement ? (
        <section
          className="statement-detail"
          aria-labelledby="statement-detail-title"
        >
          <div className="statement-detail__header">
            <div>
              <span className="statements-page__kicker">
                STATEMENT ACTIVITY
              </span>
              <h2 id="statement-detail-title">
                {selectedStatement.period}
              </h2>
              <p>
                {getAccountLabel(
                  accounts.find(
                    (account) =>
                      account.id === selectedStatement.accountId,
                  ) ?? {
                    id: "",
                    accountNumber: "",
                    accountType: "checking",
                    status: "active",
                    currency: selectedStatement.currency,
                    availableBalance: 0,
                    currentBalance: 0,
                  },
                )}
              </p>
            </div>

            <button
              type="button"
              className="statement-detail__close"
              onClick={() => setSelectedStatement(null)}
            >
              Close preview
            </button>
          </div>

          <div className="statement-detail__summary">
            <div>
              <span>Opening balance</span>
              <strong>
                {formatCurrency(
                  selectedStatement.openingBalance,
                  selectedStatement.currency,
                )}
              </strong>
            </div>

            <div>
              <span>Closing balance</span>
              <strong>
                {formatCurrency(
                  selectedStatement.closingBalance,
                  selectedStatement.currency,
                )}
              </strong>
            </div>

            <div>
              <span>Credits</span>
              <strong>
                {formatCurrency(
                  selectedStatement.deposits,
                  selectedStatement.currency,
                )}
              </strong>
            </div>

            <div>
              <span>Debits</span>
              <strong>
                {formatCurrency(
                  selectedStatement.withdrawals,
                  selectedStatement.currency,
                )}
              </strong>
            </div>
          </div>

          <div className="statement-detail__meta">
            <div>
              <span>Statement period</span>
              <strong>
                {formatDate(selectedStatement.startDate)} –{" "}
                {formatDate(selectedStatement.endDate)}
              </strong>
            </div>

            <div>
              <span>Transactions</span>
              <strong>{selectedStatement.transactionCount}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>Available</strong>
            </div>
          </div>

          <div className="statement-detail__actions">
            <button type="button" onClick={handlePrint}>
              <Printer size={17} />
              Print
            </button>
          </div>

          <div className="statement-detail__transactions">
            <div className="statement-detail__transactions-header">
              <strong>Transaction activity</strong>
              <span>
                {selectedStatement.transactionCount} transaction
                {selectedStatement.transactionCount === 1
                  ? ""
                  : "s"}
              </span>
            </div>

            {selectedStatement.transactions.map((transaction) => {
              const credit = isCreditTransaction(transaction)

              return (
                <div
                  className="statement-detail__transaction"
                  key={transaction.id}
                >
                  <div>
                    <strong>{transaction.description}</strong>
                    <span>
                      {formatDate(transaction.createdAt)} ·{" "}
                      {transaction.reference}
                    </span>
                  </div>

                  <strong className={credit ? "is-credit" : "is-debit"}>
                    {credit ? "+" : "-"}
                    {formatCurrency(
                      Math.abs(transaction.amount),
                      transaction.currency,
                    )}
                  </strong>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="statements-list" aria-label="Available statements">
          {statements.length > 0 ? (
            statements.map((statement) => (
              <article className="statement-card" key={statement.id}>
                <div
                  className="statement-card__icon"
                  aria-hidden="true"
                >
                  <FileText size={21} />
                </div>

                <div className="statement-card__main">
                  <div className="statement-card__title-row">
                    <div>
                      <h2>{statement.period}</h2>
                      <p>
                        {getAccountLabel(
                          accounts.find(
                            (account) =>
                              account.id === statement.accountId,
                          ) ?? {
                            id: "",
                            accountNumber: "",
                            accountType: "checking",
                            status: "active",
                            currency: statement.currency,
                            availableBalance: 0,
                            currentBalance: 0,
                          },
                        )}
                      </p>
                    </div>

                    <span className="statement-card__status">
                      Available
                    </span>
                  </div>

                  <div className="statement-card__meta">
                    <span>
                      <strong>Period</strong>
                      {formatDate(statement.startDate)} –{" "}
                      {formatDate(statement.endDate)}
                    </span>

                    <span>
                      <strong>Closing balance</strong>
                      {formatCurrency(
                        statement.closingBalance,
                        statement.currency,
                      )}
                    </span>

                    <span>
                      <strong>Transactions</strong>
                      {statement.transactionCount}
                    </span>
                  </div>

                  <div className="statement-card__footer">
                    <span>
                      {formatCurrency(
                        statement.deposits,
                        statement.currency,
                      )}{" "}
                      credits ·{" "}
                      {formatCurrency(
                        statement.withdrawals,
                        statement.currency,
                      )}{" "}
                      debits
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedStatement(statement)}
                    >
                      View statement
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="statements-empty">
              <FileText size={28} />
              <h2>No statement activity found</h2>
              <p>
                There is no transaction activity available for the
                selected account in the current transaction history.
              </p>

              {accountId !== "all" ? (
                <button
                  type="button"
                  onClick={() => setAccountId("all")}
                >
                  View all accounts
                </button>
              ) : null}
            </div>
          )}
        </section>
      )}

      <section className="statements-page__footer-note">
        <FileText size={18} />
        <div>
          <strong>Statement document service</strong>
          <p>
            Account activity is retrieved through authenticated APIs.
            Browser printing is available for the current statement view.
            Secure downloadable PDF statements require a server-side
            document-generation and controlled storage service, which is
            not currently present in this application.
          </p>
        </div>
      </section>
    </main>
  )
}
