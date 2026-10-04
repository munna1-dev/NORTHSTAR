import "./PublicNav.css"
import { Menu, X } from "lucide-react"
import { Link } from "react-router-dom"
import { useState } from "react"
import { BrandMark } from "./BrandMark"

export function PublicNav() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="public-nav" aria-label="Main navigation">
      <Link to="/" aria-label="NorthstarBank home"><BrandMark /></Link>
      <div className={`public-nav__links ${open ? "is-open" : ""}`}>
        <Link to="/personal" onClick={() => setOpen(false)}>Personal</Link>
        <Link to="/business" onClick={() => setOpen(false)}>Business</Link>
        <Link to="/about" onClick={() => setOpen(false)}>About</Link>
        <Link to="/support" onClick={() => setOpen(false)}>Support</Link>
      </div>
      <div className="public-nav__actions">
        <Link className="public-nav__button" to="/signin">Sign In</Link>
        <Link className="public-nav__button public-nav__button--primary" to="/open-account">Open an Account</Link>
        <button className="public-nav__menu" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>
  )
}
