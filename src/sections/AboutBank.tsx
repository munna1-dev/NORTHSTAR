import "./AboutBank.css"
import { CheckCircle2, ShieldCheck, UsersRound } from "lucide-react"

export function AboutBank() {
  return (
    <section className="about-bank" id="about">
      <div className="about-bank__intro">
        <span className="about-bank__eyebrow">ABOUT NorthStarBank</span>
        <h2>A modern banking experience built around clarity and trust.</h2>
        <p>NorthStarBank provides thoughtfully designed digital banking journeys with clear information and secure-by-design interfaces.</p>
      </div>
      <div className="about-bank__points">
        <article>
          <ShieldCheck size={22} />
          <div><h3>Security-minded design</h3><p>Access and account experiences are designed with protection and transparency in mind.</p></div>
        </article>
        <article>
          <CheckCircle2 size={22} />
          <div><h3>Clear experiences</h3><p>Simple layouts and useful information help customers understand their banking activity.</p></div>
        </article>
        <article>
          <UsersRound size={22} />
          <div><h3>Customer focused</h3><p>Every workflow is designed around practical needs and responsible financial interactions.</p></div>
        </article>
      </div>
    </section>
  )
}
