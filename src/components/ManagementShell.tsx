import { useState, type ReactNode } from 'react'
import {
  Activity,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import type { UserProfile } from '../types'
import { signOutCustomer } from '../lib/session'
import { BrandMark } from './BrandMark'
import './ManagementShell.css'

interface ManagementShellProps {
  customer: UserProfile
  children: ReactNode
}

const navigation = [
  {
    label: 'Dashboard',
    href: '/management',
    icon: LayoutDashboard,
  },
  {
    label: 'Applications',
    href: '/management/applications',
    icon: ClipboardCheck,
  },
  {
    label: 'Customers',
    href: '/management/customers',
    icon: Users,
  },
  {
    label: 'Accounts',
    href: '/management/accounts',
    icon: Building2,
  },
  {
    label: 'Transactions',
    href: '/management/transactions',
    icon: ReceiptText,
  },
  {
    label: 'Transfers & Payments',
    href: '/management/operations',
    icon: CreditCard,
  },
  {
    label: 'Support',
    href: '/management/support',
    icon: Activity,
  },
  {
    label: 'Audit Log',
    href: '/management/audit',
    icon: FileClock,
  },
  {
    label: 'Staff Control',
    href: '/management/staff',
    icon: UserCog,
  },
]

export function ManagementShell({
  customer,
  children,
}: ManagementShellProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await signOutCustomer()
    navigate('/signin', { replace: true })
  }

  return (
    <div className="management-shell">
      <aside
        className={
          open
            ? 'management-shell__sidebar management-shell__sidebar--open'
            : 'management-shell__sidebar'
        }
      >
        <div className="management-shell__brand">
          <BrandMark />
          <div>
            <strong>NorthStarBank</strong>
            <span>Management</span>
          </div>
          <button
            className="management-shell__close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="management-shell__section-label">
          OPERATIONS
        </div>

        <nav className="management-shell__nav">
          {navigation.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/management'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  isActive
                    ? 'management-shell__nav-link management-shell__nav-link--active'
                    : 'management-shell__nav-link'
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="management-shell__security">
          <ShieldCheck size={17} />
          <div>
            <strong>Authorized access</strong>
            <span>Management controls are audited.</span>
          </div>
        </div>

        <button
          type="button"
          className="management-shell__logout"
          onClick={() => void handleLogout()}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </aside>

      {open && (
        <button
          className="management-shell__backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="management-shell__main">
        <header className="management-shell__topbar">
          <button
            type="button"
            className="management-shell__menu"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </button>

          <div className="management-shell__title">
            <span>MANAGEMENT PORTAL</span>
            <strong>NorthStarBank Operations</strong>
          </div>

          <div className="management-shell__user">
            <div>
              <strong>
                {customer.firstName} {customer.lastName}
              </strong>
              <span>
                {customer.role === 'developer'
                  ? 'Developer'
                  : 'Management'}
              </span>
            </div>
            <div className="management-shell__avatar">
              {customer.firstName.charAt(0)}
              {customer.lastName.charAt(0)}
            </div>
          </div>
        </header>

        <main className="management-shell__content">
          {children}
        </main>
      </div>
    </div>
  )
}
