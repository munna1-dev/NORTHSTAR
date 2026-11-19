import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './StaffAuth.css'

type Invitation = {
  firstName: string
  lastName: string
  email: string
}

export function StaffSetupPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(
    token ? '' : 'The invitation link is missing its token.',
  )
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    if (!token) return

    fetch(`/api/public/staff-invitations?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json()

        if (!response.ok || !data.valid) {
          throw new Error(data.error || 'This invitation is not valid.')
        }

        if (active) setInvitation(data.staff)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to verify the invitation.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/public/staff-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create your password.')
      }

      setSuccess(data.message || 'Your password has been created.')
      setPassword('')
      setConfirmation('')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to complete registration.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="signin-page staff-register-page staff-auth-page">
      <section className="signin-card staff-register-card">
        <div className="signin-card__brand">
          <span className="signin-card__icon">NS</span>
          <span>NORTHSTARBANK</span>
        </div>

        <header className="signin-card__intro">
          <span className="signin-card__eyebrow">SECURE STAFF ONBOARDING</span>
          <h1>Create your staff password</h1>
          <p>Complete your secure NorthStarBank staff registration.</p>
        </header>

        {loading ? (
          <p role="status">Verifying your invitation…</p>
        ) : invitation ? (
          <>
            <div className="staff-register-result">
              <strong>Welcome, {invitation.firstName} {invitation.lastName}</strong>
              <p>Your official staff email:</p>
              <p><strong>{invitation.email}</strong></p>
            </div>

            {success ? (
              <div className="staff-register-result" role="status">
                <strong>Registration complete</strong>
                <p>{success}</p>
                <Link to="/staff">Continue to staff sign in</Link>
              </div>
            ) : (
              <form className="signin-form staff-register-form" onSubmit={submit}>
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>

                <label>
                  Confirm password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                  />
                </label>

                <p>
                  Use at least 12 characters, including uppercase and lowercase
                  letters, a number, and a symbol.
                </p>

                {error && <p className="signin-error" role="alert">{error}</p>}

                <button type="submit" disabled={submitting}>
                  {submitting ? 'Creating password…' : 'Create staff password'}
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="staff-register-result" role="alert">
            <strong>Invitation unavailable</strong>
            <p>{error}</p>
            <p>Contact the NorthStarBank management team to request a new invitation.</p>
          </div>
        )}

        <footer className="signin-card__footer">
          <Link to="/staff">Staff sign in</Link>
          <Link to="/">NorthStarBank home</Link>
        </footer>
      </section>
    </main>
  )
}
