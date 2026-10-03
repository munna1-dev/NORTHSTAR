import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { z } from "zod"
import { signInCustomer } from "../lib/session"
import "./SignInPage.css"

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const redirectPath =
    typeof location.state?.from === "string"
      ? location.state.from
      : "/customer"

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const result = signInSchema.safeParse({
      email,
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
        result.data.email,
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
          <span className="signin-card__icon" aria-hidden="true">
            NS
          </span>
          <span>NORTHSTAR</span>
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
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
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
