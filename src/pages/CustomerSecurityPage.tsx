import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Laptop,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  changeCustomerPassword,
  getCustomerSecurity,
  revokeCustomerSession,
  revokeOtherCustomerSessions,
  type CustomerSession,
  type CustomerSecurityEvent,
} from "../lib/customerApi"
import "./CustomerSecurityPage.css"

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function deviceIcon(session: CustomerSession) {
  return /mobile/i.test(session.device) ? Smartphone : Laptop
}

function validateNewPassword(password: string): string | null {
  if (password.length < 12) {
    return "New password must be at least 12 characters."
  }

  if (password.length > 128) {
    return "New password must not exceed 128 characters."
  }

  if (!/[A-Z]/.test(password)) {
    return "New password must contain an uppercase letter."
  }

  if (!/[a-z]/.test(password)) {
    return "New password must contain a lowercase letter."
  }

  if (!/[0-9]/.test(password)) {
    return "New password must contain a number."
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "New password must contain a special character."
  }

  return null
}

export function CustomerSecurityPage() {
  const [sessions, setSessions] = useState<CustomerSession[]>([])
  const [events, setEvents] = useState<CustomerSecurityEvent[]>([])
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function load() {
    setError("")

    try {
      const result = await getCustomerSecurity()
      setSessions(result.sessions)
      setEvents(result.securityEvents)
      setTwoFactorEnabled(result.twoFactorEnabled)
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load security information.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  async function revoke(sessionId: string) {
    setWorking(sessionId)
    setMessage("")
    setError("")

    try {
      await revokeCustomerSession(sessionId)
      setMessage("The selected session has been signed out.")
      await load()
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to sign out the session.",
      )
    } finally {
      setWorking("")
    }
  }

  async function revokeOthers() {
    setWorking("others")
    setMessage("")
    setError("")

    try {
      const count = await revokeOtherCustomerSessions()
      setMessage(
        count === 1
          ? "1 other session was signed out."
          : `${count} other sessions were signed out.`,
      )
      await load()
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to sign out other sessions.",
      )
    } finally {
      setWorking("")
    }
  }

  async function handlePasswordChange(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setMessage("")
    setError("")

    if (!currentPassword) {
      setError("Enter your current password.")
      return
    }

    if (!newPassword) {
      setError("Enter a new password.")
      return
    }

    const passwordError = validateNewPassword(newPassword)

    if (passwordError) {
      setError(passwordError)
      return
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.")
      return
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.")
      return
    }

    setWorking("password")

    try {
      const result = await changeCustomerPassword(
        currentPassword,
        newPassword,
        confirmPassword,
      )

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      setMessage(result.message)
      await load()
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to change your password.",
      )
    } finally {
      setWorking("")
    }
  }

  return (
    <main className="customer-security-page">
      <header className="customer-security-header">
        <Link to="/customer" className="customer-security-back">
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <span className="customer-security-kicker">SECURITY CENTER</span>
        <h1>Security &amp; Sessions</h1>
        <p>
          Manage your password, review active customer sessions, and monitor
          recent security activity.
        </p>
      </header>

      {message && (
        <div className="customer-security-notice" role="status">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {error && (
        <div className="customer-security-warning" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Security request could not be completed</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading security information…</p>
      ) : (
        <section className="customer-security-grid">
          <article className="customer-security-card customer-security-card--wide">
            <div className="customer-security-card__header">
              <div>
                <span className="customer-security-card__eyebrow">
                  Password security
                </span>
                <h2>Change your password</h2>
              </div>
              <ShieldCheck size={23} />
            </div>

            <p className="customer-security-card__description">
              Use a strong password that you do not reuse on other services.
              Changing your password signs out your other active sessions.
            </p>

            <form
              className="customer-security-password-form"
              onSubmit={(event) => void handlePasswordChange(event)}
            >
              <label className="customer-security-field">
                <span>Current password</span>
                <div className="customer-security-password-input">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                    autoComplete="current-password"
                    disabled={working === "password"}
                  />
                  <button
                    type="button"
                    aria-label={
                      showCurrentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                    onClick={() =>
                      setShowCurrentPassword((visible) => !visible)
                    }
                  >
                    {showCurrentPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </label>

              <label className="customer-security-field">
                <span>New password</span>
                <div className="customer-security-password-input">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={working === "password"}
                  />
                  <button
                    type="button"
                    aria-label={
                      showNewPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                    onClick={() => setShowNewPassword((visible) => !visible)}
                  >
                    {showNewPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </label>

              <label className="customer-security-field">
                <span>Confirm new password</span>
                <div className="customer-security-password-input">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    disabled={working === "password"}
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmPassword
                        ? "Hide password confirmation"
                        : "Show password confirmation"
                    }
                    onClick={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </label>

              <div className="customer-security-password-requirements">
                <strong>Password requirements</strong>
                <ul>
                  <li>12–128 characters</li>
                  <li>At least one uppercase letter</li>
                  <li>At least one lowercase letter</li>
                  <li>At least one number</li>
                  <li>At least one special character</li>
                </ul>
              </div>

              <div className="customer-security-password-actions">
                <button
                  className="customer-security-secondary-button"
                  type="button"
                  disabled={working === "password"}
                  onClick={() => {
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                    setError("")
                  }}
                >
                  Clear
                </button>

                <button
                  className="customer-security-primary-button"
                  type="submit"
                  disabled={working === "password"}
                >
                  <ShieldCheck size={16} />
                  {working === "password"
                    ? "Updating password…"
                    : "Update password"}
                </button>
              </div>
            </form>
          </article>

          <article className="customer-security-card customer-security-card--wide">
            <div className="customer-security-card__header">
              <div>
                <span className="customer-security-card__eyebrow">
                  Active access
                </span>
                <h2>Your sessions</h2>
              </div>
              <MonitorSmartphone size={23} />
            </div>

            <div className="customer-security-sessions">
              {sessions.map((session) => {
                const DeviceIcon = deviceIcon(session)

                return (
                  <div className="customer-security-session" key={session.id}>
                    <div className="customer-security-session__icon">
                      <DeviceIcon size={21} />
                    </div>

                    <div className="customer-security-session__details">
                      <strong>{session.device}</strong>
                      <span>{session.browser}</span>
                      <small>
                        <Clock3 size={13} />
                        Last active {formatDate(session.lastActiveAt)}
                      </small>
                    </div>

                    <div className="customer-security-session__actions">
                      {session.isCurrent ? (
                        <span className="customer-security-current">
                          <CheckCircle2 size={14} />
                          Current
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={working === session.id}
                          onClick={() => void revoke(session.id)}
                        >
                          <LogOut size={15} />
                          {working === session.id ? "Signing out…" : "Sign out"}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {sessions.some((session) => !session.isCurrent) && (
              <button
                className="customer-security-danger-button"
                type="button"
                disabled={working === "others"}
                onClick={() => void revokeOthers()}
              >
                <LogOut size={16} />
                {working === "others"
                  ? "Signing out…"
                  : "Sign out all other sessions"}
              </button>
            )}
          </article>

          <article className="customer-security-card">
            <div className="customer-security-card__header">
              <div>
                <span className="customer-security-card__eyebrow">
                  Authentication
                </span>
                <h2>Two-factor authentication</h2>
              </div>
              <ShieldCheck size={23} />
            </div>

            <div className="customer-security-status">
              {twoFactorEnabled ? (
                <>
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Enabled</strong>
                    <span>
                      Two-factor authentication is enabled on this account.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <XCircle size={18} />
                  <div>
                    <strong>Not enabled</strong>
                    <span>
                      Additional verification has not been configured.
                    </span>
                  </div>
                </>
              )}
            </div>

            <p className="customer-security-card__description">
              Multi-factor enrollment requires a dedicated verification
              workflow. The account status shown here is read directly from
              the customer record.
            </p>
          </article>

          <article className="customer-security-card">
            <div className="customer-security-card__header">
              <div>
                <span className="customer-security-card__eyebrow">
                  Security history
                </span>
                <h2>Recent events</h2>
              </div>
              <ShieldCheck size={23} />
            </div>

            {events.length === 0 ? (
              <p className="customer-security-card__description">
                No recent security events have been recorded.
              </p>
            ) : (
              <div className="customer-security-sessions">
                {events.slice(0, 8).map((event) => (
                  <div className="customer-security-session" key={event.id}>
                    <div className="customer-security-session__icon">
                      <ShieldCheck size={19} />
                    </div>
                    <div className="customer-security-session__details">
                      <strong>{event.type.replace(/_/g, " ")}</strong>
                      <small>{formatDate(event.createdAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}
    </main>
  )
}
