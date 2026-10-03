import "./PersonalBanking.css"
import { ArrowRight, CreditCard, PiggyBank, WalletCards } from "lucide-react"

export function PersonalBanking() {
  return (
    <section className="personal-banking" id="personal">
      <div className="personal-banking__intro">
        <span className="personal-banking__eyebrow">PERSONAL BANKING</span>
        <h2>Everyday banking, designed around your goals.</h2>
        <p>Manage spending, saving, and everyday money needs through a clear and secure banking experience.</p>
      </div>
      <div className="personal-banking__grid">
        <article className="personal-banking__card">
          <div className="personal-banking__icon"><WalletCards size={22} /></div>
          <h3>Checking</h3>
          <p>Manage everyday spending with a simple account experience.</p>
          <button type="button">Learn more <ArrowRight size={16} /></button>
        </article>
        <article className="personal-banking__card">
          <div className="personal-banking__icon"><PiggyBank size={22} /></div>
          <h3>Savings</h3>
          <p>Set money aside and keep your savings organized around your plans.</p>
          <button type="button">Learn more <ArrowRight size={16} /></button>
        </article>
        <article className="personal-banking__card">
          <div className="personal-banking__icon"><CreditCard size={22} /></div>
          <h3>Cards</h3>
          <p>Explore flexible card tools for everyday purchases and account management.</p>
          <button type="button">Learn more <ArrowRight size={16} /></button>
        </article>
      </div>
    </section>
  )
}
