import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Plus,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  createCustomerPayment,
  getCustomerAccounts,
  getCustomerBeneficiaries,
} from "../lib/customerApi"
import { formatCurrency } from "../lib/format"
import type { BankAccount, Beneficiary } from "../types"
import "./CustomerPaymentsPage.css"

function today() {
  return new Date().toISOString().slice(0, 10)
}

function maskAccount(value: string) {
  const trimmed = value.trim()

  if (trimmed.length <= 4) {
    return trimmed
  }

  return `•••• ${trimmed.slice(-4)}`
}

export function CustomerPaymentsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])

  const [accountId, setAccountId] = useState("")
  const [beneficiaryId, setBeneficiaryId] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(today())
  const [memo, setMemo] = useState("")

  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedPayment, setSubmittedPayment] = useState<{
    reference: string
    status: string
    amount: number
    currency: string
    scheduledFor: string | null
  } | null>(null)

  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [accountResult, beneficiaryResult] = await Promise.all([
          getCustomerAccounts(),
          getCustomerBeneficiaries(),
        ])

        if (cancelled) {
          return
        }

        const activeAccounts = accountResult.filter(
          (account) => account.status === "active",
        )

        const activeBeneficiaries = beneficiaryResult.filter(
          (beneficiary) => beneficiary.status === "active",
        )

        setAccounts(activeAccounts)
        setBeneficiaries(activeBeneficiaries)

        setAccountId(activeAccounts[0]?.id ?? "")
        setBeneficiaryId(activeBeneficiaries[0]?.id ?? "")
        setError("")
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your payment information.",
          )
        }
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

  const source = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  )

  const beneficiary = useMemo(
    () =>
      beneficiaries.find(
        (item) => item.id === beneficiaryId,
      ),
    [beneficiaries, beneficiaryId],
  )

  const numericAmount = Number(amount)

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!source) {
      setError("Select an active account.")
      return
    }

    if (!beneficiary) {
      setError("Select an active beneficiary.")
      return
    }

    if (
      !amount.trim() ||
      !/^\d+(\.\d{1,2})?$/.test(amount.trim()) ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError(
        "Enter a valid payment amount with up to 2 decimal places.",
      )
      return
    }

    if (numericAmount > source.availableBalance) {
      setError("The payment amount exceeds the available balance.")
      return
    }

    if (!paymentDate) {
      setError("Select a payment date.")
      return
    }

    if (paymentDate < today()) {
      setError("The payment date cannot be in the past.")
      return
    }

    setReviewing(true)
  }

  async function handleConfirm() {
    if (!source || !beneficiary) {
      setError("Your payment details are no longer available.")
      setReviewing(false)
      return
    }

    setSubmitting(true)
    setError("")

    try {
      const payment = await createCustomerPayment({
        accountId: source.id,
        payeeName: beneficiary.name,
        payeeReference: beneficiary.accountNumber,
        amount: amount.trim(),
        currency: source.currency,
        scheduledFor: paymentDate,
        description: memo.trim(),
        idempotencyKey: crypto.randomUUID(),
      })

      setSubmittedPayment({
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        scheduledFor: payment.scheduledFor,
      })

      setReviewing(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit the payment instruction.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function resetPayment() {
    setAmount("")
    setMemo("")
    setPaymentDate(today())
    setReviewing(false)
    setSubmittedPayment(null)
    setError("")

    if (accounts.length > 0) {
      setAccountId(accounts[0].id)
    }

    if (beneficiaries.length > 0) {
      setBeneficiaryId(beneficiaries[0].id)
    }
  }

  if (loading) {
    return (
      <main className="customer-payments-page">
        <header className="customer-payments-header">
          <Link
            to="/customer"
            className="customer-payments-back"
          >
            <ArrowLeft size={17} />
            Dashboard
          </Link>

          <span className="customer-payments-kicker">
            CUSTOMER BANKING
          </span>

          <h1>Pay a bill</h1>

          <p>Loading your payment information…</p>
        </header>

        <section className="customer-payments-card">
          <div className="customer-payments-card__title">
            <div className="customer-payments-card__icon">
              <CreditCard size={20} />
            </div>

            <div>
              <strong>Preparing payment services</strong>
              <span>
                Loading your accounts and saved beneficiaries.
              </span>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (submittedPayment) {
    return (
      <main className="customer-payments-page">
        <section className="customer-payment-result">
          <div className="customer-payment-result__icon">
            <CheckCircle2 size={34} />
          </div>

          <span className="customer-payments-kicker">
            PAYMENT INSTRUCTION
          </span>

          <h1>Payment submitted</h1>

          <p>
            Your payment instruction has been recorded and is
            currently pending. The payment has not been represented
            as externally settled.
          </p>

          <div className="customer-payment-reference">
            <span>Reference</span>
            <strong>{submittedPayment.reference}</strong>
          </div>

          <div className="customer-payment-summary">
            <div>
              <span>Status</span>
              <strong>
                {submittedPayment.status}
              </strong>
            </div>

            <div>
              <span>Amount</span>
              <strong>
                {formatCurrency(
                  submittedPayment.amount,
                  submittedPayment.currency,
                )}
              </strong>
            </div>

            <div>
              <span>Scheduled date</span>
              <strong>
                {submittedPayment.scheduledFor ?? "—"}
              </strong>
            </div>
          </div>

          <div className="customer-payment-result__actions">
            <Link to="/customer">Return to dashboard</Link>

            <button
              type="button"
              onClick={resetPayment}
            >
              Make another payment
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (beneficiaries.length === 0) {
    return (
      <main className="customer-payments-page">
        <header className="customer-payments-header">
          <Link
            to="/customer"
            className="customer-payments-back"
          >
            <ArrowLeft size={17} />
            Dashboard
          </Link>

          <span className="customer-payments-kicker">
            CUSTOMER BANKING
          </span>

          <h1>Pay a bill</h1>

          <p>
            Submit a payment instruction using one of your saved
            beneficiaries.
          </p>
        </header>

        <section className="customer-payments-card">
          <div className="customer-payments-card__title">
            <div className="customer-payments-card__icon">
              <CreditCard size={20} />
            </div>

            <div>
              <strong>No active beneficiaries</strong>
              <span>
                Add a beneficiary before creating a payment.
              </span>
            </div>
          </div>

          <div className="customer-payment-result__actions">
            <Link to="/customer/beneficiaries">
              <Plus size={16} />
              Add beneficiary
            </Link>

            <Link to="/customer">
              Return to dashboard
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="customer-payments-page">
      <header className="customer-payments-header">
        <Link
          to="/customer"
          className="customer-payments-back"
        >
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <span className="customer-payments-kicker">
          CUSTOMER BANKING
        </span>

        <h1>Pay a bill</h1>

        <p>
          Submit a payment instruction to one of your saved
          beneficiaries.
        </p>
      </header>

      {error && (
        <div
          className="customer-payments-note"
          role="alert"
        >
          <strong>
            <AlertTriangle
              size={16}
              style={{
                verticalAlign: "middle",
                marginRight: 7,
              }}
            />
            Payment could not be completed
          </strong>
          <p>{error}</p>
        </div>
      )}

      <section className="customer-payments-card">
        {!reviewing ? (
          <form onSubmit={handleReview}>
            <div className="customer-payments-card__title">
              <div className="customer-payments-card__icon">
                <CreditCard size={20} />
              </div>

              <div>
                <strong>New payment</strong>
                <span>
                  Create a payment instruction for a saved
                  beneficiary.
                </span>
              </div>
            </div>

            <div className="customer-payments-form">
              <label>
                Beneficiary
                <select
                  value={beneficiaryId}
                  onChange={(event) =>
                    setBeneficiaryId(event.target.value)
                  }
                >
                  {beneficiaries.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name} —{" "}
                      {maskAccount(item.accountNumber)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                From account
                <select
                  value={accountId}
                  onChange={(event) =>
                    setAccountId(event.target.value)
                  }
                >
                  {accounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.accountType
                        .charAt(0)
                        .toUpperCase() +
                        account.accountType.slice(1)}{" "}
                      {maskAccount(account.accountNumber)} —{" "}
                      {formatCurrency(
                        account.availableBalance,
                        account.currency,
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Amount
                <div className="customer-payments-amount">
                  <span>
                    {source?.currency === "USD"
                      ? "$"
                      : source?.currency ?? ""}
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value)
                    }
                    placeholder="0.00"
                    aria-label="Payment amount"
                  />
                </div>
              </label>

              <label>
                Payment date
                <div className="customer-payments-date">
                  <CalendarDays size={17} />

                  <input
                    type="date"
                    min={today()}
                    value={paymentDate}
                    onChange={(event) =>
                      setPaymentDate(event.target.value)
                    }
                  />
                </div>
              </label>

              <label>
                Memo
                <input
                  type="text"
                  maxLength={500}
                  value={memo}
                  onChange={(event) =>
                    setMemo(event.target.value)
                  }
                  placeholder="Optional payment memo"
                />
              </label>

              <button
                type="submit"
                className="customer-payments-primary"
              >
                Review payment
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
        ) : (
          <div className="customer-payment-review">
            <div className="customer-payments-card__title">
              <div className="customer-payments-card__icon">
                <CreditCard size={20} />
              </div>

              <div>
                <strong>Review payment</strong>
                <span>
                  Confirm the details before submitting.
                </span>
              </div>
            </div>

            <div className="customer-payment-summary">
              <div>
                <span>Beneficiary</span>
                <strong>{beneficiary?.name}</strong>
              </div>

              <div>
                <span>Beneficiary account</span>
                <strong>
                  {beneficiary
                    ? maskAccount(
                        beneficiary.accountNumber,
                      )
                    : "—"}
                </strong>
              </div>

              <div>
                <span>From account</span>
                <strong>
                  {source
                    ? maskAccount(source.accountNumber)
                    : "—"}
                </strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>
                  {source
                    ? formatCurrency(
                        numericAmount,
                        source.currency,
                      )
                    : "—"}
                </strong>
              </div>

              <div>
                <span>Payment date</span>
                <strong>{paymentDate}</strong>
              </div>

              <div>
                <span>Memo</span>
                <strong>
                  {memo.trim() || "No memo"}
                </strong>
              </div>
            </div>

            <div className="customer-payment-review__actions">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setReviewing(false)
                  setError("")
                }}
              >
                Edit
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirm()}
              >
                {submitting
                  ? "Submitting…"
                  : "Submit payment"}
                {!submitting && (
                  <CheckCircle2 size={17} />
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="customer-payments-note">
        <strong>
          <ShieldCheck
            size={16}
            style={{
              verticalAlign: "middle",
              marginRight: 7,
            }}
          />
          Secure payment instruction
        </strong>

        <p>
          Payment instructions are created through your
          authenticated NorthStarBank session and recorded with a
          unique reference. The current system records the
          instruction as pending; it does not claim external biller
          settlement until an external payment rail is integrated.
        </p>
      </section>
    </main>
  )
}
