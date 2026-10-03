import { useState } from "react"
import type { FormEvent } from "react"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import { AppShell } from "../layouts/AppShell"

type AccountType = "checking" | "savings" | "business" | "credit"

export function OpenAccountPage() {
  const [accountType, setAccountType] = useState<AccountType>("checking")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [reference, setReference] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    try {
      const response = await fetch("/api/public/account-applications", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          accountType,
          firstName,
          lastName,
          email,
          phone,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error ?? "Unable to submit your application.",
        )
      }

      setReference(result.application.reference)
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to submit your application.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (reference) {
    return (
      <AppShell>
        <section className="open-account-page">
          <div className="open-account-success">
            <CheckCircle2 size={48} />
            <span>APPLICATION RECEIVED</span>
            <h1>Thank you for applying</h1>
            <p>
              Your NorthStarBank account application has been received and is
              pending review.
            </p>

            <div className="open-account-reference">
              <small>Application reference</small>
              <strong>{reference}</strong>
            </div>

            <p className="open-account-note">
              Keep this reference for your records. Account activation is
              subject to review and approval.
            </p>
          </div>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <section className="open-account-page">
        <div className="open-account-header">
          <span>NorthStarBank</span>
          <h1>Open an account</h1>
          <p>
            Submit an application for review. Only basic contact and
            application information is requested at this stage.
          </p>
        </div>

        <form className="open-account-form" onSubmit={submit}>
          <label>
            <span>Account type</span>
            <select
              value={accountType}
              onChange={(event) =>
                setAccountType(event.target.value as AccountType)
              }
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="business">Business</option>
              <option value="credit">Credit</option>
            </select>
          </label>

          <div className="open-account-row">
            <label>
              <span>First name</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                maxLength={100}
              />
            </label>

            <label>
              <span>Last name</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                maxLength={100}
              />
            </label>
          </div>

          <label>
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={320}
            />
          </label>

          <label>
            <span>Phone number</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              maxLength={40}
            />
          </label>

          {error && (
            <p className="open-account-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting application…" : "Submit application"}
          </button>

          <div className="open-account-security">
            <ShieldCheck size={18} />
            <span>
              Applications are submitted over the authenticated HTTPS
              application endpoint. Do not enter passwords, card numbers,
              account credentials, or identity-document numbers in this form.
            </span>
          </div>
        </form>
      </section>
    </AppShell>
  )
}
