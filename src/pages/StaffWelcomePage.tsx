import { Link } from "react-router-dom"
import {
  ArrowRight,
  ShieldCheck,
  Globe2,
  Landmark,
  LockKeyhole,
} from "lucide-react"
import "./StaffWelcomePage.css"

export function StaffWelcomePage() {
  return (
    <main className="staff-welcome">
      <header className="staff-welcome-header">
        <Link to="/" className="staff-welcome-brand">
          <img src="/northstarbank-logo.svg" alt="NorthStarBank" />
          <span>NORTHSTARBANK</span>
        </Link>
        <span className="staff-welcome-secure">
          <ShieldCheck size={16} />
          Secure Staff Portal
        </span>
      </header>

      <section className="staff-welcome-hero">
        <div className="staff-welcome-copy">
          <span className="staff-welcome-eyebrow">
            NORTHSTARBANK · STAFF SERVICES
          </span>
          <h1>Welcome to your professional banking workspace.</h1>
          <p>
            A secure gateway for NorthStarBank employees, management
            professionals and authorised banking personnel.
          </p>

          <div className="staff-welcome-actions">
            <Link to="/staff" className="staff-welcome-primary">
              <LockKeyhole size={18} />
              Existing staff — Sign in
              <ArrowRight size={18} />
            </Link>

            <Link to="/staff/register" className="staff-welcome-secondary">
              New staff — Apply for access
              <ArrowRight size={17} />
            </Link>
          </div>

          <div className="staff-welcome-assurance">
            <ShieldCheck size={18} />
            Staff access is subject to identity verification and management approval.
          </div>
        </div>

        <div className="staff-welcome-visual">
          <div className="staff-welcome-visual-icon">
            <Landmark size={54} strokeWidth={1.3} />
          </div>
          <span>ONE BANKING STANDARD</span>
          <h2>Clarity. Security. Accountability.</h2>
          <p>
            Supporting responsible banking operations through
            controlled staff access.
          </p>
          <div className="staff-welcome-visual-line" />
          <span className="staff-welcome-visual-footer">
            NORTHSTARBANK · STAFF ACCESS
          </span>
        </div>
      </section>

      <section className="staff-welcome-platforms">
        <div className="staff-welcome-section-heading">
          <span>OUR DIGITAL PLATFORMS</span>
          <h2>Connected banking services</h2>
          <p>
            Explore the NorthStarBank digital environment.
          </p>
        </div>

        <div className="staff-welcome-platform-grid">
          <article className="staff-welcome-platform">
            <Globe2 size={25} />
            <h3>Public Banking Website</h3>
            <p>
              Explore banking services, personal banking,
              business solutions and customer support.
            </p>
            <a href="https://northstarbank.site">
              Visit public website <ArrowRight size={16} />
            </a>
          </article>

          <article className="staff-welcome-platform">
            <ShieldCheck size={25} />
            <h3>Management Portal</h3>
            <p>
              An authorised workspace for customer applications,
              accounts, transactions, operations, staff and audit controls.
            </p>
            <Link to="/management">
              Management access <ArrowRight size={16} />
            </Link>
          </article>
        </div>
      </section>

      <footer className="staff-welcome-footer">
        <span>© {new Date().getFullYear()} NorthStarBank</span>
        <span>Secure access · Authorised personnel only</span>
        <a href="https://northstarbank.site">Official website</a>
      </footer>
    </main>
  )
}
