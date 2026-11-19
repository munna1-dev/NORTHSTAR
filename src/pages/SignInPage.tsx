import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { z } from "zod"
import { signInCustomer } from "../lib/session"
import "./SignInPage.css"

const signInSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email address.").max(320),
  password: z.string().min(1, "Enter your password."),
})

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const redirectPath =
    typeof location.state?.from === "string"
      ? location.state.from
      : "/customer"

  const sessionExpired =
    location.state?.sessionExpired === true

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const result = signInSchema.safeParse({
      identifier,
      password,
    })

    if (!result.success) {
      setError(
        result.error.issues[0]?.message ??
          "Please check your sign-in details.",
      )
      return
    }

    setSubmitting(true)

    try {
      const response = await signInCustomer(
        result.data.identifier,
        result.data.password,
      )

      if (!response.ok) {
        setError(response.error ?? "Unable to sign in.")
        return
      }

      navigate(redirectPath, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="signin-page">
      <section className="signin-card" aria-labelledby="signin-title">
        <div className="signin-card__brand">
          <img
            className="signin-card__brand-logo"
            src="/northstarbank-logo.svg"
            alt="NorthStarBank"
          />
        </div>

        <div className="signin-card__intro">
          <span className="signin-card__eyebrow">
            CUSTOMER BANKING
          </span>
          <h1 id="signin-title">Sign in to your account</h1>
          <p>
            Securely access your NorthStarBank accounts, transactions,
            transfers, and account services.
          </p>
        </div>

        {sessionExpired && (
          <div className="signin-session-expired" role="alert">
            <ShieldCheck size={18} />
            <div>
              <strong>Your session has expired</strong>
              <span>
                For your security, you were signed out after 15 minutes
                of inactivity. Please sign in again to continue.
              </span>
            </div>
          </div>
        )}

        <div className="signin-demo-notice">
          <ShieldCheck size={18} />
          <div>
            <strong>Secure customer access</strong>
            <span>
              Your credentials are transmitted securely and verified by
              the NorthStarBank authentication service.
            </span>
          </div>
        </div>

        <form
          className="signin-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <label htmlFor="identifier">Username or email address</label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Your username or email address"
            disabled={submitting}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            disabled={submitting}
          />

          {error && (
            <p className="signin-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            <LockKeyhole size={17} />
            {submitting ? "Signing in…" : "Sign in"}
            {!submitting && <ArrowRight size={17} />}
          </button>
        </form>

        <div className="signin-card__footer">
          <Link to="/">Return to NorthStarBank</Link>
          <span>Secure customer portal</span>
        </div>
      </section>
    </main>
  )
}
