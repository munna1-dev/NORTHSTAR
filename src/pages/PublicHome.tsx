import "./PublicHome.css"
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react"
import { AppShell } from "../layouts/AppShell"
import { Link } from "react-router-dom"

export function PublicHome() {
  return (
    <AppShell>
      <section className="home-hero">
        <div className="home-hero__content">
          <span className="home-hero__eyebrow">MODERN BANKING • BUILT FOR YOU</span>
          <h1>Banking that puts clarity, security, and control first.</h1>
          <p>
            Manage everyday banking, save with confidence, and stay in control
            of your financial journey from one secure experience.
          </p>
          <div className="home-hero__actions">
            <Link to="/open-account" className="home-button home-button--primary">
              Open an Account
              <ArrowRight size={18} />
            </Link>
            <Link to="/personal" className="home-button home-button--secondary">
              Explore Banking
            </Link>
          </div>
          <div className="home-hero__trust">
            <ShieldCheck size={19} />
            <span>Secure digital banking experience</span>
          </div>
        </div>
        <div className="home-hero__panel">
          <div className="home-card">
            <div className="home-card__top">
              <span>Available Balance</span>
              <LockKeyhole size={18} />
            </div>
            <strong>$24,680.90</strong>
            <span className="home-card__masked">NORTHSTARBANK •••• 4821</span>
            <div className="home-card__line">
              <span>Checking Account</span>
              <span>USD</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-features" aria-label="Banking features">
        <article>
          <div className="home-feature__icon"><ShieldCheck size={21} /></div>
          <h2>Security first</h2>
          <p>Designed around secure access, clear controls, and responsible account protection.</p>
        </article>
        <article>
          <div className="home-feature__icon"><CheckCircle2 size={21} /></div>
          <h2>Simple everyday banking</h2>
          <p>Keep accounts, balances, payments, transfers, and activity organized in one place.</p>
        </article>
        <article>
          <div className="home-feature__icon"><LockKeyhole size={21} /></div>
          <h2>Built for confidence</h2>
          <p>Clear information and thoughtful workflows help you stay informed about your finances.</p>
        </article>
      </section>
    </AppShell>
  )
}
