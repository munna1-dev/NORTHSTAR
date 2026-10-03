import "./SupportBank.css"
import { ArrowRight, CircleHelp, Headphones, MessageSquareText } from "lucide-react"

export function SupportBank() {
  return (
    <section className="support-bank" id="support">
      <div className="support-bank__intro">
        <span className="support-bank__eyebrow">SUPPORT</span>
        <h2>Help when you need it.</h2>
        <p>Find answers, explore common banking questions, or connect with the NorthStarBank support experience.</p>
      </div>
      <div className="support-bank__grid">
        <article className="support-bank__card">
          <div className="support-bank__icon"><CircleHelp size={22} /></div>
          <h3>Help Center</h3>
          <p>Browse common questions and practical information about everyday banking.</p>
          <button type="button">Explore help <ArrowRight size={16} /></button>
        </article>
        <article className="support-bank__card">
          <div className="support-bank__icon"><MessageSquareText size={22} /></div>
          <h3>Contact Support</h3>
          <p>Send a support request and keep your questions organized.</p>
          <button type="button">Contact us <ArrowRight size={16} /></button>
        </article>
        <article className="support-bank__card">
          <div className="support-bank__icon"><Headphones size={22} /></div>
          <h3>Customer Assistance</h3>
          <p>Get guidance through the support workflow for account-related questions.</p>
          <button type="button">Get assistance <ArrowRight size={16} /></button>
        </article>
      </div>
    </section>
  )
}
