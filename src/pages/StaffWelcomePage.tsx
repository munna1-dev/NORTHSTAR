import { Link } from "react-router-dom"
import { BrandMark } from "../components/BrandMark"
import {
  ArrowRight,
  ShieldCheck,
  LockKeyhole,
  Landmark,
  Users,
  WalletCards,
  ClipboardCheck,
  Activity,
  Headset,
  ScrollText,
  CheckCircle2,
} from "lucide-react"
import "./StaffWelcomePage.css"

const managementAreas = [
  {
    icon: ClipboardCheck,
    title: "Application Review",
    description:
      "Review customer applications and support controlled approval workflows.",
  },
  {
    icon: Users,
    title: "Customer Management",
    description:
      "Access authorised customer records and manage customer service operations.",
  },
  {
    icon: WalletCards,
    title: "Accounts & Cards",
    description:
      "Oversee account operations, card requests and related service activities.",
  },
  {
    icon: Activity,
    title: "Financial Operations",
    description:
      "Review transfers, payments, deposits and other financial requests.",
  },
  {
    icon: Headset,
    title: "Customer Support",
    description:
      "Coordinate service requests and follow up on outstanding customer issues.",
  },
  {
    icon: ScrollText,
    title: "Audit & Governance",
    description:
      "Maintain operational oversight through audit records and accountability controls.",
  },
]

export function StaffWelcomePage() {
  return (
    <main className="staff-welcome">
      <header className="staff-welcome-header">
        <Link to="/" className="staff-welcome-brand">
          <BrandMark />
          <span>
            NORTHSTARBANK
            <small>STAFF & MANAGEMENT</small>
          </span>
        </Link>

        <div className="staff-welcome-header-right">
          <span className="staff-welcome-secure">
            <ShieldCheck size={16} />
            Secure staff environment
          </span>
          <Link to="/staff" className="staff-welcome-header-login">
            Staff sign in <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="staff-welcome-hero">
        <div className="staff-welcome-copy">
          <span className="staff-welcome-eyebrow">
            NORTHSTARBANK · OFFICIAL STAFF PORTAL
          </span>

          <h1>
            Welcome to
            <span> NorthStarBank Management.</span>
          </h1>

          <p>
            A dedicated workspace for authorised banking personnel.
            Access your management responsibilities, coordinate banking
            operations and support customers through a secure,
            accountable environment.
          </p>

          <div className="staff-welcome-actions">
            <Link to="/staff" className="staff-welcome-primary">
              <LockKeyhole size={18} />
              Sign in to your account
              <ArrowRight size={18} />
            </Link>

            <Link to="/staff/register" className="staff-welcome-secondary">
              Apply for staff access
              <ArrowRight size={17} />
            </Link>
          </div>

          <div className="staff-welcome-assurance">
            <ShieldCheck size={19} />
            <span>
              Access is restricted to authorised personnel. New staff
              applications are subject to identity verification and
              management approval.
            </span>
          </div>
        </div>

        <aside className="staff-welcome-visual">
          <div className="staff-welcome-visual-top">
            <span className="staff-welcome-visual-mark">
              <Landmark size={31} strokeWidth={1.5} />
            </span>
            <span className="staff-welcome-visual-status">
              <span />
              CONTROLLED ACCESS
            </span>
          </div>

          <span className="staff-welcome-visual-label">
            THE NORTHSTARBANK STANDARD
          </span>

          <h2>Professional banking operations. Built on trust.</h2>

          <p>
            One coordinated environment for responsible decisions,
            secure processes and reliable customer service.
          </p>

          <div className="staff-welcome-visual-divider" />

          <div className="staff-welcome-visual-points">
            <span><CheckCircle2 size={16} /> Secure staff authentication</span>
            <span><CheckCircle2 size={16} /> Role-based access controls</span>
            <span><CheckCircle2 size={16} /> Operational accountability</span>
          </div>

          <div className="staff-welcome-visual-footer">
            NORTHSTARBANK <span>·</span> STAFF & MANAGEMENT PORTAL
          </div>
        </aside>
      </section>

      <section className="staff-welcome-platforms">
        <div className="staff-welcome-section-heading">
          <span>MANAGEMENT ENVIRONMENT</span>
          <h2>One workspace. Essential banking operations.</h2>
          <p>
            The management environment brings key operational responsibilities
            together, with access governed by staff roles and permissions.
          </p>
        </div>

        <div className="staff-welcome-platform-grid">
          {managementAreas.map((area) => {
            const Icon = area.icon

            return (
              <article className="staff-welcome-platform" key={area.title}>
                <span className="staff-welcome-platform-icon">
                  <Icon size={23} strokeWidth={1.8} />
                </span>
                <h3>{area.title}</h3>
                <p>{area.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="staff-welcome-access">
        <div className="staff-welcome-access-icon">
          <ShieldCheck size={25} />
        </div>
        <div>
          <span>ACCESS & SECURITY</span>
          <h2>Your role determines your access.</h2>
          <p>
            Management functions are available only after authentication
            and are governed by assigned staff permissions. Sensitive
            activities remain subject to the bank's approval and control
            processes.
          </p>
        </div>
        <Link to="/staff" className="staff-welcome-access-link">
          Continue to sign in <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="staff-welcome-footer">
        <span>© {new Date().getFullYear()} NorthStarBank</span>
        <span>Official staff and management environment</span>
        <span className="staff-welcome-footer-secure">
          <ShieldCheck size={14} /> Authorised personnel only
        </span>
      </footer>
    </main>
  )
}
