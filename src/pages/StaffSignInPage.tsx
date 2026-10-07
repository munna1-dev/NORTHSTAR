import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { z } from "zod"
import { signInStaff } from "../lib/session"
import "./SignInPage.css"

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

export function StaffSignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
      const response = await signInStaff(
        result.data.email,
        result.data.password,
      )

      if (!response.ok) {
        setError(response.error ?? "Unable to sign in.")
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
          <span className="signin-card__icon" aria-hidden="true">
            NS
          </span>
          <span>NORTHSTAR</span>
        </div>

        <div className="signin-card__intro">
          <span className="signin-card__eyebrow">
            NORTHSTARBANK
          </span>
          <h1 id="staff-signin-title">BANK MANAGEMENT PORTAL</h1>
          <p>
            Secure sign-in for NorthStarBank staff, management,
            developers, and Super Managers.
          </p>
        </div>

        <div className="signin-demo-notice">
          <ShieldCheck size={18} />
          <div>
            <strong>Protected management access</strong>
            <span>
              Staff credentials are verified by the NorthStarBank
              authentication service before management access is granted.
            </span>
          </div>
        </div>

        <form
          className="signin-form"
          onSubmit={handleSubmit}
          noValidate
        >
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

          {error && (
            <p className="signin-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            <LockKeyhole size={17} />
            {submitting ? "Signing in…" : "Enter management portal"}
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
