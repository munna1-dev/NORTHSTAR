import { useEffect, useState } from "react"
import {
  Bell,
  Check,
  Globe2,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react"
import {
  getCustomerPreferences,
  saveCustomerPreferences,
  type CustomerPreferences,
} from "../lib/customerApi"
import "./CustomerSettingsPage.css"

const defaults: Omit<CustomerPreferences, "updatedAt"> = {
  emailAlerts: true,
  transactionAlerts: true,
  securityAlerts: true,
  marketingEmails: false,
  productUpdates: true,
  language: "English",
  currency: "USD",
  compactTransactions: false,
}

export function CustomerSettingsPage() {
  const [preferences, setPreferences] =
    useState<Omit<CustomerPreferences, "updatedAt">>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    getCustomerPreferences()
      .then((value) => {
        if (!active) return
        const { updatedAt, ...editable } = value
        void updatedAt
        setPreferences(editable)
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load settings.",
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function update<K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K],
  ) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError("")
    setSaved(false)

    try {
      await saveCustomerPreferences(preferences)
      setSaved(true)
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save settings.",
      )
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setPreferences(defaults)
    setSaved(false)
  }

  if (loading) {
    return <div className="settings-page"><p>Loading your preferences…</p></div>
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <span className="settings-eyebrow">NorthStarBank settings</span>
          <h1>Settings &amp; Preferences</h1>
          <p>
            Control customer communications and how your banking portal is
            displayed.
          </p>
        </div>

        <div className="settings-header-actions">
          <button
            className="settings-secondary-button"
            type="button"
            onClick={reset}
            disabled={saving}
          >
            <RotateCcw size={17} />
            Reset
          </button>

          <button
            className="settings-primary-button"
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={17} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {saved && (
        <div className="settings-success" role="status">
          <Check size={18} />
          <div>
            <strong>Preferences saved</strong>
            <span>Your preferences are now stored with your account.</span>
          </div>
        </div>
      )}

      {error && (
        <div className="settings-notice" role="alert">
          <ShieldCheck size={19} />
          <div>
            <strong>Unable to update settings</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon"><Bell size={20} /></div>
            <div>
              <h2>Notifications</h2>
              <p>Choose which account communications you receive.</p>
            </div>
          </div>

          <div className="settings-options">
            {[
              ["emailAlerts", "Email notifications", "Receive important account communications by email."],
              ["transactionAlerts", "Transaction alerts", "Receive alerts when transactions are posted."],
              ["securityAlerts", "Security alerts", "Receive alerts about sign-ins and important security events."],
              ["marketingEmails", "Marketing communications", "Receive promotional offers and general marketing messages."],
              ["productUpdates", "Product updates", "Receive information about new NorthStarBank products and features."],
            ].map(([key, title, description]) => (
              <label className="settings-option" key={key}>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <input
                  type="checkbox"
                  checked={preferences[key as keyof typeof preferences] as boolean}
                  onChange={(event) =>
                    update(
                      key as keyof typeof preferences,
                      event.target.checked as never,
                    )
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon"><Globe2 size={20} /></div>
            <div>
              <h2>Regional preferences</h2>
              <p>Choose how information is presented in your portal.</p>
            </div>
          </div>

          <div className="settings-fields">
            <label>
              <span>Language</span>
              <select
                value={preferences.language}
                onChange={(event) =>
                  update("language", event.target.value as "English")
                }
              >
                <option>English</option>
              </select>
            </label>

            <label>
              <span>Display currency</span>
              <select
                value={preferences.currency}
                onChange={(event) =>
                  update(
                    "currency",
                    event.target.value as "USD" | "EUR" | "GBP",
                  )
                }
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </label>

            <label className="settings-option">
              <span>
                <strong>Compact transaction display</strong>
                <small>Use a denser transaction layout.</small>
              </span>
              <input
                type="checkbox"
                checked={preferences.compactTransactions}
                onChange={(event) =>
                  update("compactTransactions", event.target.checked)
                }
              />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon"><ShieldCheck size={20} /></div>
            <div>
              <h2>Security</h2>
              <p>Review dedicated security controls from the Security Center.</p>
            </div>
          </div>

          <div className="settings-security-list">
            <div className="settings-security-row">
              <div>
                <strong>Password</strong>
                <span>Use the Security Center to manage authentication.</span>
              </div>
              <a href="/customer/security">Security Center</a>
            </div>

            <div className="settings-security-row">
              <div>
                <strong>Sessions</strong>
                <span>Review and revoke active customer sessions.</span>
              </div>
              <a href="/customer/security">Review sessions</a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
