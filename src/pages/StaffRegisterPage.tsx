import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import './StaffRegisterPage.css'
import './StaffAuth.css'

type StaffRole = {
  role_key: string
  role_name: string
  description: string | null
}

export function StaffRegisterPage() {
  const [roles, setRoles] = useState<StaffRole[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reference, setReference] = useState('')

  useEffect(() => {
    let active = true

    fetch('/api/public/staff-applications')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load staff roles.')
        }
        if (active) setRoles(data.roles ?? [])
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to load staff roles.')
        }
      })
      .finally(() => {
        if (active) setLoadingRoles(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setReference('')

    const form = event.currentTarget
    const formData = new FormData(form)

    const payload = {
      firstName: String(formData.get('firstName') ?? ''),
      lastName: String(formData.get('lastName') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      department: String(formData.get('department') ?? ''),
      requestedRole: String(formData.get('requestedRole') ?? ''),
      applicationNotes: String(formData.get('applicationNotes') ?? ''),
      website: String(formData.get('website') ?? ''),
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/public/staff-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit your application.')
      }

      setSuccess(data.message || 'Your application has been received.')
      setReference(data.application?.reference ?? '')
      form.reset()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit your application.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="signin-page staff-register-page staff-auth-page">
      <section className="signin-card staff-register-card">
        <div className="signin-card__brand">
          <BrandMark />
        </div>

        <header className="signin-card__intro">
          <span className="signin-card__eyebrow">CAREERS & STAFF ACCESS</span>
          <h1>Staff registration</h1>
          <p>
            Submit your details for review by NorthStarBank management.
            Staff access is only created after approval.
          </p>
        </header>

        {success ? (
          <div className="staff-register-result" role="status">
            <strong>Application received</strong>
            <p>{success}</p>
            {reference && <p className="staff-register-reference">Reference: {reference}</p>}
            <p>Keep your personal email accessible. If approved, your official staff sign-in address and secure password-setup instructions will be sent there.</p>
          </div>
        ) : (
          <form className="signin-form staff-register-form" onSubmit={submitApplication}>
            <div className="staff-register-grid">
              <label>
                First name
                <input name="firstName" autoComplete="given-name" minLength={2} maxLength={100} required />
              </label>
              <label>
                Last name
                <input name="lastName" autoComplete="family-name" minLength={2} maxLength={100} required />
              </label>
            </div>

            <label>
              Personal email address
              <input name="email" type="email" autoComplete="email" maxLength={320} required />
            </label>

            <label>
              Phone number
              <input name="phone" type="tel" autoComplete="tel" minLength={7} maxLength={40} required />
            </label>

            <label>
              Department
              <input name="department" minLength={2} maxLength={100} placeholder="e.g. Operations" required />
            </label>

            <label>
              Requested role
              <select name="requestedRole" required defaultValue="">
                <option value="" disabled>
                  {loadingRoles ? 'Loading available roles…' : 'Select a role'}
                </option>
                {roles.map((role) => (
                  <option key={role.role_key} value={role.role_key}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Additional information (optional)
              <textarea name="applicationNotes" rows={4} maxLength={2000} placeholder="Relevant experience or application details" />
            </label>

            <div className="staff-register-honeypot" aria-hidden="true">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {error && <p className="signin-error" role="alert">{error}</p>}

            <button type="submit" disabled={submitting || loadingRoles || roles.length === 0}>
              {submitting ? 'Submitting application…' : 'Submit staff application'}
            </button>
          </form>
        )}

        {error && success && <p className="signin-error" role="alert">{error}</p>}

        <footer className="signin-card__footer">
          <Link to="/staff">Already have staff access? Sign in</Link>
          <Link to="/">NorthStarBank home</Link>
        </footer>
      </section>
    </main>
  )
}
