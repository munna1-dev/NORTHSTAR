import {
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getCustomerProfile } from "../lib/customerApi"
import { signOutCustomer } from "../lib/session"
import type { UserProfile } from "../types"
import "./CustomerProfilePage.css"

export function CustomerProfilePage() {
  const [customer, setCustomer] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      try {
        const result = await getCustomerProfile()

        if (!mounted) {
          return
        }

        setCustomer(result)
      } catch (loadError) {
        if (!mounted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your profile.",
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [])

  async function handleSignOut() {
    await signOutCustomer()
    window.location.assign("/")
  }

  if (loading) {
    return (
      <section className="customer-profile">
        <div className="customer-profile__loading">
          <p>Loading your profile…</p>
        </div>
      </section>
    )
  }

  if (error || !customer) {
    return (
      <section className="customer-profile">
        <div className="customer-profile__error" role="alert">
          <strong>Unable to load your profile</strong>
          <p>{error || "Your customer profile is unavailable."}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  const initials =
    `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase()

  return (
    <section className="customer-profile">
      <header className="customer-profile__hero">
        <div>
          <span className="customer-profile__eyebrow">
            CUSTOMER BANKING
          </span>
          <h1>Profile</h1>
          <p>
            Review the personal information associated with your
            NorthStarBank customer profile.
          </p>
        </div>
      </header>

      <div className="customer-profile__grid">
        <section className="customer-profile__card customer-profile__identity">
          <div className="customer-profile__avatar" aria-hidden="true">
            {initials}
          </div>

          <div>
            <span>Customer</span>
            <h2>
              {customer.firstName} {customer.lastName}
            </h2>
            <p>
              Customer #{customer.customerNumber}
            </p>
          </div>

          <span
            className={`customer-profile__status customer-profile__status--${customer.status}`}
          >
            {customer.status}
          </span>
        </section>

        <section className="customer-profile__card">
          <div className="customer-profile__section-heading">
            <UserRound size={19} />
            <div>
              <span>PERSONAL INFORMATION</span>
              <h2>Contact details</h2>
            </div>
          </div>

          <div className="customer-profile__details">
            <div>
              <span>Full name</span>
              <strong>
                {customer.firstName} {customer.lastName}
              </strong>
            </div>

            <div>
              <span>Email address</span>
              <strong>
                <Mail size={16} />
                {customer.email}
              </strong>
            </div>

            <div>
              <span>Phone number</span>
              <strong>
                <Phone size={16} />
                {customer.phone || "Not provided"}
              </strong>
            </div>

            <div>
              <span>Customer number</span>
              <strong>{customer.customerNumber}</strong>
            </div>

            <div>
              <span>Account status</span>
              <strong>{customer.status}</strong>
            </div>

            <div>
              <span>Customer role</span>
              <strong>{customer.role}</strong>
            </div>
          </div>
        </section>

        <section className="customer-profile__card">
          <div className="customer-profile__section-heading">
            <ShieldCheck size={19} />
            <div>
              <span>ACCOUNT SECURITY</span>
              <h2>Security settings</h2>
            </div>
          </div>

          <div className="customer-profile__security">
            <div>
              <strong>Secure authentication</strong>
              <p>
                Your customer session is protected by an HttpOnly
                secure session cookie.
              </p>
            </div>

            <Link to="/customer/security">
              Review security
            </Link>
          </div>

          <div className="customer-profile__security">
            <div>
              <strong>Password and multi-factor authentication</strong>
              <p>
                Password and MFA management will be available through
                the dedicated security controls.
              </p>
            </div>

            <Link to="/customer/security">
              Security controls
            </Link>
          </div>
        </section>

        <section className="customer-profile__card">
          <div className="customer-profile__section-heading">
            <ShieldCheck size={19} />
            <div>
              <span>SESSION</span>
              <h2>Account access</h2>
            </div>
          </div>

          <p className="customer-profile__session-copy">
            You are signed in to the NorthStarBank customer portal.
            Sign out when you are finished using a shared or public
            device.
          </p>

          <button
            className="customer-profile__signout"
            type="button"
            onClick={handleSignOut}
          >
            Sign out securely
          </button>
        </section>
      </div>
    </section>
  )
}
