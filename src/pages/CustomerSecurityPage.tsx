import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
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

export function CustomerSecurityPage() {
  const [sessions, setSessions] = useState<CustomerSession[]>([])
  const [events, setEvents] = useState<CustomerSecurityEvent[]>([])
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

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
          Review active customer sessions and recent security activity.
        </p>
      </header>

      {message && (
        <div className="customer-security-notice">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {error && (
        <div className="customer-security-warning">
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
