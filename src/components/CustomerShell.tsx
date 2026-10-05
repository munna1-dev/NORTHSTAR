import "../pages/customer-portal.css";
import {
  ArrowRightLeft,
  Bell,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  ListOrdered,
  LogOut,
  Menu,
  UserRound,
  UsersRound,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { signOutCustomer } from "../lib/session"
import type { UserProfile } from "../types"
import "./CustomerShell.css"

interface CustomerShellProps {
  children: ReactNode
  customer: UserProfile
}

const navigation = [
  {
    label: "Dashboard",
    href: "/customer",
    icon: LayoutDashboard,
  },
  {
    label: "Accounts",
    href: "/customer/accounts",
    icon: CreditCard,
  },
  {
    label: "Transactions",
    href: "/customer/transactions",
    icon: ListOrdered,
  },
  {
    label: "Transfer",
    href: "/customer/transfer",
    icon: ArrowRightLeft,
  },
  {
    label: "Payments",
    href: "/customer/payments",
    icon: CreditCard,
  },
  {
    label: "Cards",
    href: "/customer/cards",
    icon: Layers,
  },
  {
    label: "Notifications",
    href: "/customer/notifications",
    icon: Bell,
  },
  {
    label: "Support",
    href: "/customer/support",
    icon: LifeBuoy,
  },
  {
    label: "Profile",
    href: "/customer/profile",
    icon: UserRound,
  },
  {
    label: "Statements",
    href: "/customer/statements",
    icon: FileText,
  },
  {
    label: "Beneficiaries",
    href: "/customer/beneficiaries",
    icon: UsersRound,
  },
  {
    label: "Settings",
    href: "/customer/settings",
    icon: Settings,
  },
  {
    label: "Security",
    href: "/customer/security",
    icon: ShieldCheck,
  },
]

export function CustomerShell({ children, customer }: CustomerShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOutCustomer()
    setMenuOpen(false)
    navigate("/")
  }

  return (
    <div className="customer-shell">
      <header className="customer-shell__header">
        <div className="customer-shell__header-inner">
          <Link to="/customer" className="customer-shell__brand">
            <span className="customer-shell__brand-mark">NS</span>

            <span>
              <strong>NORTHSTAR</strong>
              <small>Customer Banking</small>
            </span>
          </Link>

          <button
            type="button"
            className="customer-shell__menu-button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>

          <div className="customer-shell__user">
            <div className="customer-shell__user-avatar">
              {customer.profileImageUrl ? (
                <img
                  src={`${customer.profileImageUrl}?v=${encodeURIComponent(customer.id)}`}
                  alt=""
                />
              ) : (
                <>
                  {customer.firstName.charAt(0)}
                  {customer.lastName.charAt(0)}
                </>
              )}
            </div>

            <div>
              <strong>
                {customer.firstName} {customer.lastName}
              </strong>
              <span>Customer #{customer.customerNumber}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="customer-shell__layout">
        <aside
          className={`customer-shell__sidebar${
            menuOpen ? " customer-shell__sidebar--open" : ""
          }`}
        >
          <nav aria-label="Customer banking">
            <span className="customer-shell__nav-label">BANKING</span>

            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === "/customer"}
                  className={({ isActive }) =>
                    `customer-shell__nav-link${
                      isActive ? " customer-shell__nav-link--active" : ""
                    }`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="customer-shell__sidebar-bottom">
            <span className="customer-shell__nav-label">ACCOUNT</span>

            <Link
              to="/customer/profile"
              className="customer-shell__nav-link"
              onClick={() => setMenuOpen(false)}
            >
              <UserRound size={18} />
              <span>Profile</span>
            </Link>

            <button
              type="button"
              className="customer-shell__nav-link customer-shell__signout"
              onClick={handleSignOut}
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {menuOpen && (
          <button
            type="button"
            className="customer-shell__overlay"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <main className="customer-shell__content">{children}</main>
      </div>

      <footer className="customer-shell__footer">
        <span>NorthStarBank Customer Banking</span>
        <span>Secure customer portal</span>
      </footer>
    </div>
  )
}
