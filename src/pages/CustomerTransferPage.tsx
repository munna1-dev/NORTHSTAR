import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Send,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { getCustomerAccounts, createCustomerTransfer } from "../lib/customerApi"
import type { BankAccount } from "../types"
import { formatCurrency } from "../lib/format"
import "./CustomerTransferPage.css"

interface TransferResult {
  reference: string
  amount: number
  currency: string
  createdAt: string
}

export function CustomerTransferPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [fromAccount, setFromAccount] = useState("")
  const [toAccount, setToAccount] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [reviewing, setReviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [result, setResult] = useState<TransferResult | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAccounts() {
      try {
        const loadedAccounts = await getCustomerAccounts()

        if (cancelled) {
          return
        }

        const activeAccounts = loadedAccounts.filter(
          (account) => account.status === "active",
        )

        setAccounts(activeAccounts)
        setFromAccount(activeAccounts[0]?.id ?? "")
        setToAccount(activeAccounts[1]?.id ?? "")
        setError("")
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your accounts.",
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAccounts()

    return () => {
      cancelled = true
    }
  }, [])

  const source = useMemo(
    () => accounts.find((account) => account.id === fromAccount),
    [accounts, fromAccount],
  )

  const destination = useMemo(
    () => accounts.find((account) => account.id === toAccount),
    [accounts, toAccount],
  )

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!source || !destination) {
      setError("Select a valid source and destination account.")
      return
    }

    if (source.id === destination.id) {
      setError("Choose different source and destination accounts.")
      return
    }

    if (source.currency !== destination.currency) {
      setError(
        "Transfers between accounts with different currencies are not supported.",
      )
      return
    }

    const normalizedAmount = amount.trim()

    if (!/^\\d+(\\.\\d{1,2})?$/.test(normalizedAmount)) {
      setError("Enter a valid amount with up to 2 decimal places.")
      return
    }

    if (Number(normalizedAmount) <= 0) {
      setError("Transfer amount must be greater than zero.")
      return
    }

    if (Number(normalizedAmount) > source.availableBalance) {
      setError("The transfer amount exceeds your available balance.")
      return
    }

    setReviewing(true)
  }

  async function handleConfirm() {
    if (!source || !destination) {
      setError("Your selected accounts are no longer available.")
      setReviewing(false)
      return
    }

    setSubmitting(true)
    setError("")

    try {
      const transfer = await createCustomerTransfer({
        fromAccountId: source.id,
        toAccountId: destination.id,
        amount: amount.trim(),
        description: description.trim(),
        idempotencyKey: crypto.randomUUID(),
      })

      setResult({
        reference: transfer.reference,
        amount: transfer.amount,
        currency: transfer.currency,
        createdAt: transfer.createdAt,
      })

      const refreshedAccounts = await getCustomerAccounts()
      const activeAccounts = refreshedAccounts.filter(
        (account) => account.status === "active",
      )

      setAccounts(activeAccounts)
      setReviewing(false)
      setCompleted(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete the transfer.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function resetTransfer() {
    const activeAccounts = accounts.filter(
      (account) => account.status === "active",
    )

    setAmount("")
    setDescription("")
    setReviewing(false)
    setCompleted(false)
    setResult(null)
    setError("")
    setFromAccount(activeAccounts[0]?.id ?? "")
    setToAccount(activeAccounts[1]?.id ?? "")
  }

  if (completed && result) {
    return (
      <main className="customer-transfer-page">
        <section className="customer-transfer-result">
          <div className="customer-transfer-result__icon">
            <CheckCircle2 size={34} />
          </div>

          <span className="customer-transfer-kicker">
            TRANSFER COMPLETED
          </span>

          <h1>Transfer completed</h1>

          <p>
            Your internal account transfer was completed successfully.
            Your account balances have been updated.
          </p>

          <div className="customer-transfer-reference">
            <span>Reference</span>
            <strong>{result.reference}</strong>
          </div>

          <div className="customer-transfer-summary">
            <div>
              <span>Amount</span>
              <strong>
                {formatCurrency(result.amount, result.currency)}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>Completed</strong>
            </div>
          </div>

          <div className="customer-transfer-result__actions">
            <Link to="/customer">Return to dashboard</Link>

            <button type="button" onClick={resetTransfer}>
              Make another transfer
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="customer-transfer-page">
      <header className="customer-transfer-header">
        <Link to="/customer" className="customer-transfer-back">
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <span className="customer-transfer-kicker">
          CUSTOMER BANKING
        </span>

        <h1>Transfer between accounts</h1>

        <p>
          Move funds securely between your eligible NorthStarBank accounts.
        </p>
      </header>

      {error && (
        <div className="customer-transfer-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="customer-transfer-card">
        {loading ? (
          <div className="customer-transfer-review">
            <LoaderCircle className="spin" size={24} />
            <p>Loading your accounts...</p>
          </div>
        ) : accounts.length < 2 ? (
          <div className="customer-transfer-review">
            <div className="customer-transfer-card__icon">
              <AlertTriangle size={20} />
            </div>

            <div>
              <strong>Two active accounts are required</strong>
              <span>
                Internal transfers require at least two active accounts
                in your customer profile.
              </span>
            </div>
          </div>
        ) : !reviewing ? (
          <form onSubmit={handleReview}>
            <div className="customer-transfer-card__title">
              <div className="customer-transfer-card__icon">
                <Send size={20} />
              </div>

              <div>
                <strong>New transfer</strong>
                <span>Transfer between your own accounts</span>
              </div>
            </div>

            <div className="customer-transfer-form">
              <label>
                From account
                <select
                  value={fromAccount}
                  onChange={(event) => setFromAccount(event.target.value)}
                  disabled={submitting}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountType} • {account.accountNumber} —{" "}
                      {formatCurrency(
                        account.availableBalance,
                        account.currency,
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                To account
                <select
                  value={toAccount}
                  onChange={(event) => setToAccount(event.target.value)}
                  disabled={submitting}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountType} • {account.accountNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Amount
                <div className="customer-transfer-amount">
                  <span>{source?.currency ?? "USD"}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    autoComplete="off"
                    disabled={submitting}
                  />
                </div>
              </label>

              <label>
                Description
                <input
                  type="text"
                  maxLength={500}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional transfer description"
                  disabled={submitting}
                />
              </label>

              <button
                type="submit"
                className="customer-transfer-primary"
                disabled={submitting}
              >
                Review transfer
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
        ) : (
          <div className="customer-transfer-review">
            <div className="customer-transfer-card__title">
              <div className="customer-transfer-card__icon">
                <Send size={20} />
              </div>

              <div>
                <strong>Review transfer</strong>
                <span>Confirm the details before submitting</span>
              </div>
            </div>

            <div className="customer-transfer-summary">
              <div>
                <span>From</span>
                <strong>{source?.accountNumber}</strong>
              </div>

              <div>
                <span>To</span>
                <strong>{destination?.accountNumber}</strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>
                  {formatCurrency(
                    Number(amount),
                    source?.currency ?? "USD",
                  )}
                </strong>
              </div>

              <div>
                <span>Description</span>
                <strong>{description || "No description"}</strong>
              </div>
            </div>

            <div className="customer-transfer-review__actions">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                disabled={submitting}
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="spin" size={17} />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm transfer
                    <CheckCircle2 size={17} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="customer-transfer-note">
        <strong>Secure internal transfer</strong>
        <p>
          Transfers are authorized against your authenticated customer
          session and processed atomically. This page currently supports
          transfers between your own NorthStarBank accounts; it does not
          represent settlement through an external bank or payment network.
        </p>
      </section>
    </main>
  )
}
