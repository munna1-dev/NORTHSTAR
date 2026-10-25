import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { z } from "zod"
import { signInStaff, verifyStaffMfa } from "../lib/session"
import "./SignInPage.css"

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

export function StaffSignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [challengeToken, setChallengeToken] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    try {
      if (challengeToken) {
        if (!/^\d{6}$/.test(code)) {
          setError("Enter the six-digit code from your authenticator app.")
          return
        }

        const result = await verifyStaffMfa(challengeToken, code)

        if (!result.ok) {
          setError(result.error ?? "Authenticator verification failed.")
          return
        }

        navigate("/management", { replace: true })
        return
      }

      const result = signInSchema.safeParse({ email, password })

      if (!result.success) {
        setError(result.error.issues[0]?.message ?? "Please check your sign-in details.")
        return
      }

      const response = await signInStaff(result.data.email, result.data.password)

      if (!response.ok) {
        setError(response.error ?? "Unable to sign in.")
        return
      }

      if (response.mfaRequired) {
        if (!response.challengeToken) {
          setError("The server did not return a valid MFA challenge. Please try again.")
          return
        }

        setChallengeToken(response.challengeToken)
        setPassword("")
        return
      }

      navigate("/management", { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="signin-page">
      <section className="signin-card" aria-labelledby="staff-signin-title">
        <div className="signin-card__brand">
          <span className="signin-card__icon" aria-hidden="true">NS</span>
          <span>NORTHSTAR</span>
        </div>

        <div className="signin-card__intro">
          <span className="signin-card__eyebrow">NORTHSTARBANK</span>
          <h1 id="staff-signin-title">BANK MANAGEMENT PORTAL</h1>
          <p>
            Secure sign-in for NorthStarBank staff, management,
            developers, and Super Managers.
          </p>
        </div>

        <div className="signin-demo-notice">
          <ShieldCheck size={18} />
          <div>
            <strong>{challengeToken ? "Verify your identity" : "Protected management access"}</strong>
            <span>
              {challengeToken
                ? "Enter the current six-digit code from your authenticator app."
                : "Staff credentials are verified by the NorthStarBank authentication service before management access is granted."}
            </span>
          </div>
        </div>

        <form className="signin-form" onSubmit={handleSubmit} noValidate>
          {!challengeToken ? (
            <>
              <label htmlFor="staff-email">Staff email address</label>
              <input
                id="staff-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@northstarbank.site"
                disabled={submitting}
              />

              <label htmlFor="staff-password">Password</label>
              <input
                id="staff-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                disabled={submitting}
              />
            </>
          ) : (
            <>
              <label htmlFor="staff-mfa-code">Authenticator code</label>
              <input
                id="staff-mfa-code"
                name="one-time-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                disabled={submitting}
                autoFocus
              />
              <button
                type="button"
                className="signin-secondary-button"
                disabled={submitting}
                onClick={() => {
                  setChallengeToken("")
                  setCode("")
                  setError("")
                }}
              >
                Back to password sign-in
              </button>
            </>
          )}

          {error && <p className="signin-error" role="alert">{error}</p>}

          <button type="submit" disabled={submitting}>
            <LockKeyhole size={17} />
            {submitting
              ? "Verifying…"
              : challengeToken
                ? "Verify and continue"
                : "Enter management portal"}
            {!submitting && <ArrowRight size={17} />}
          </button>
        </form>

        <div className="signin-card__footer">
          <Link to="/">Return to NorthStarBank</Link>
          <span>Bank management portal</span>
        </div>
      </section>
    </main>
  )
}
