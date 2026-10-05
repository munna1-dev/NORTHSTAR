import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  getManagementProfile,
  updateManagementProfile,
  type ManagementProfile,
} from '../../lib/managementApi'
import { getCurrentCustomer } from '../../lib/session'
import './ManagementProfilePage.css'

function roleLabel(role: string): string {
  switch (role) {
    case 'super_manager':
      return 'Super Manager'
    case 'developer':
      return 'Developer'
    case 'staff':
      return 'Staff'
    default:
      return 'Management'
  }
}

export function ManagementProfilePage() {
  const [profile, setProfile] = useState<ManagementProfile | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [canUpdate, setCanUpdate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      try {
        const [result, customer] = await Promise.all([
          getManagementProfile(),
          getCurrentCustomer(),
        ])

        if (cancelled) return

        setProfile(result)
        setFirstName(result.first_name)
        setLastName(result.last_name)
        setPhone(result.phone ?? '')

        const permissions = customer?.permissions ?? []
        setCanUpdate(
          result.role === 'super_manager' ||
            permissions.includes('profile.update'),
        )
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load your management profile.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canUpdate || saving) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated = await updateManagementProfile({
        first_name: firstName,
        last_name: lastName,
        phone,
      })

      setProfile(updated)
      setFirstName(updated.first_name)
      setLastName(updated.last_name)
      setPhone(updated.phone ?? '')
      setSuccess('Your management profile has been updated.')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update your profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    if (!profile) {
      return
    }

    setFirstName(profile.first_name)
    setLastName(profile.last_name)
    setPhone(profile.phone ?? '')
    setError('')
    setSuccess('')
  }

  if (loading) {
    return (
      <section className="management-profile">
        <div className="management-profile__state">
          <RefreshCw size={20} className="management-profile__spin" />
          <span>Loading management profile…</span>
        </div>
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="management-profile">
        <div className="management-profile__state management-profile__state--error">
          <span>{error || 'Management profile could not be loaded.'}</span>
          <button
            type="button"
            className="management-profile__button management-profile__button--secondary"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="management-profile">
      <header className="management-profile__hero">
        <div>
          <span className="management-profile__eyebrow">
            MANAGEMENT ACCOUNT
          </span>
          <h1>My Profile</h1>
          <p>
            Review your staff identity and update the personal information
            you are authorized to change.
          </p>
        </div>

        <div className="management-profile__hero-badge">
          <UserRound size={20} />
          <span>{roleLabel(profile.role)}</span>
        </div>
      </header>

      {error && (
        <div className="management-profile__notice management-profile__notice--error">
          {error}
        </div>
      )}

      {success && (
        <div className="management-profile__notice management-profile__notice--success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <div className="management-profile__grid">
        <form
          className="management-profile__card"
          onSubmit={handleSubmit}
        >
          <div className="management-profile__card-heading">
            <div>
              <span className="management-profile__card-kicker">
                PERSONAL INFORMATION
              </span>
              <h2>Profile details</h2>
            </div>
            <UserRound size={20} />
          </div>

          <div className="management-profile__fields">
            <label>
              <span>First name</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                maxLength={80}
                disabled={!canUpdate || saving}
                autoComplete="given-name"
              />
            </label>

            <label>
              <span>Last name</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                maxLength={80}
                disabled={!canUpdate || saving}
                autoComplete="family-name"
              />
            </label>

            <label className="management-profile__field--full">
              <span>Phone number</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={40}
                disabled={!canUpdate || saving}
                autoComplete="tel"
              />
            </label>
          </div>

          {!canUpdate && (
            <div className="management-profile__permission-note">
              <LockKeyhole size={17} />
              <span>
                Your Super Manager has not granted you permission to update
                your profile.
              </span>
            </div>
          )}

          <div className="management-profile__actions">
            <button
              type="button"
              className="management-profile__button management-profile__button--secondary"
              onClick={resetForm}
              disabled={saving}
            >
              Reset
            </button>

            <button
              type="submit"
              className="management-profile__button management-profile__button--primary"
              disabled={!canUpdate || saving}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={16}
                    className="management-profile__spin"
                  />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="management-profile__card management-profile__card--identity">
          <div className="management-profile__card-heading">
            <div>
              <span className="management-profile__card-kicker">
                STAFF IDENTITY
              </span>
              <h2>Account information</h2>
            </div>
            <ShieldCheck size={20} />
          </div>

          <dl className="management-profile__details">
            <div>
              <dt>Email</dt>
              <dd>{profile.email}</dd>
            </div>

            <div>
              <dt>Customer number</dt>
              <dd>{profile.customer_number}</dd>
            </div>

            <div>
              <dt>Staff ID</dt>
              <dd className="management-profile__staff-id">
                {profile.staff_id || 'Not assigned'}
              </dd>
            </div>

            <div>
              <dt>Employee number</dt>
              <dd>{profile.employee_number || 'Not assigned'}</dd>
            </div>

            <div>
              <dt>Department</dt>
              <dd>{profile.department || 'Not assigned'}</dd>
            </div>

            <div>
              <dt>Role</dt>
              <dd>{roleLabel(profile.role)}</dd>
            </div>

            <div>
              <dt>Account status</dt>
              <dd>{profile.status}</dd>
            </div>

            <div>
              <dt>Staff status</dt>
              <dd>{profile.staff_status || 'Not applicable'}</dd>
            </div>

            <div>
              <dt>Two-factor authentication</dt>
              <dd>
                {profile.two_factor_enabled ? 'Enabled' : 'Not enabled'}
              </dd>
            </div>
          </dl>

          <div className="management-profile__security-note">
            <LockKeyhole size={17} />
            <span>
              Staff ID, role, permissions, department, status, email and
              security settings are controlled by authorized management.
            </span>
          </div>
        </aside>
      </div>
    </section>
  )
}
