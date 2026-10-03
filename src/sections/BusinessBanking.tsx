import "./BusinessBanking.css"
import { ArrowRight, Building2, Landmark, ReceiptText } from "lucide-react"

export function BusinessBanking() {
  return (
    <section className="business-banking" id="business">
      <div className="business-banking__intro">
        <span className="business-banking__eyebrow">BUSINESS BANKING</span>
        <h2>Tools to help your business manage money with confidence.</h2>
        <p>Organize business finances with practical account options and workflows designed for growing organizations.</p>
      </div>
      <div className="business-banking__grid">
        <article className="business-banking__card">
          <div className="business-banking__icon"><Building2 size={22} /></div>
          <h3>Business Accounts</h3>
          <p>Keep operating funds organized with business-focused account experiences.</p>
          <button type="button">Learn more <ArrowRight size={16} /></button>
        </article>
        <article className="business-banking__card">
          <div className="business-banking__icon"><Landmark size={22} /></div>
          <h3>Business Lending</h3>
          <p>Explore financing workflows designed to support business planning and growth.</p>
          <button type="button">Learn more <ArrowRight size={16} /></button>
        </article>
        <article className="business-banking__card">
          <div className="business-banking__icon"><ReceiptText size={22} /></div>
          <h3>Payment Services</h3>
          <p>Keep payment activity organized with clear tools for business operations.</p>
          <button type="button">Learn more <ArrowRight size={16} /></button>
        </article>
      </div>
    </section>
  )
}
