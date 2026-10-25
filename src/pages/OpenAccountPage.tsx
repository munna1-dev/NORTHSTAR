import { useState } from "react"
import type { FormEvent } from "react"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import { AppShell } from "../layouts/AppShell"

type AccountType = "checking" | "savings" | "business" | "credit"

export function OpenAccountPage() {
  const [accountType, setAccountType] = useState<AccountType>("checking")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [stateCode, setStateCode] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [countryCode, setCountryCode] = useState("US")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [reference, setReference] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("The passwords do not match.")
      return
    }

    if (password.length < 12) {
      setError("Choose a password with at least 12 characters.")
      return
    }

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
          username,
          password,
          email,
          phone,
          dateOfBirth,
          addressLine1,
          addressLine2,
          city,
          stateCode,
          postalCode,
          countryCode,
          acceptedTerms,
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
              Your registration has been received and is pending management review. You cannot sign in to banking until your application is approved.
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
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              required
              minLength={4}
              maxLength={40}
              pattern="[a-z0-9_]{4,40}"
              autoComplete="username"
              title="Use 4–40 lowercase letters, numbers, or underscores."
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>

          <label>
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>

          <label>
            <span>Date of birth</span>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              required
              autoComplete="bday"
            />
          </label>

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

          <label>
            <span>Address line 1</span>
            <input
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              required
              maxLength={200}
              autoComplete="address-line1"
            />
          </label>

          <label>
            <span>Address line 2 (optional)</span>
            <input
              value={addressLine2}
              onChange={(event) => setAddressLine2(event.target.value)}
              maxLength={200}
              autoComplete="address-line2"
            />
          </label>

          <div className="open-account-row">
            <label>
              <span>City</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
                maxLength={100}
                autoComplete="address-level2"
              />
            </label>
            <label>
              <span>State / Province</span>
              <input
                value={stateCode}
                onChange={(event) => setStateCode(event.target.value)}
                required
                maxLength={100}
                autoComplete="address-level1"
              />
            </label>
          </div>

          <div className="open-account-row">
            <label>
              <span>Postal code</span>
              <input
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                required
                maxLength={20}
                autoComplete="postal-code"
              />
            </label>
            <label>
              <span>Country code (2 letters)</span>
              <input
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
                required
                minLength={2}
                maxLength={2}
                pattern="[A-Za-z]{2}"
                autoComplete="country"
                title="Enter the two-letter country code, such as US or NG."
              />
            </label>
          </div>

          <label className="open-account-terms">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
            />
            <span>I confirm that the information provided is accurate and agree to the applicable account terms.</span>
          </label>

          {error && (
            <p className="open-account-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting application…" : "Create account application"}
          </button>

          <div className="open-account-security">
            <ShieldCheck size={18} />
            <span>
              Your password is transmitted to the registration endpoint over HTTPS and stored as a password hash. Your application remains pending until management review. No photo is required at registration; your account can use initials until profile-image upload becomes available after approval.
            </span>
          </div>
        </form>
      </section>
    </AppShell>
  )
}
