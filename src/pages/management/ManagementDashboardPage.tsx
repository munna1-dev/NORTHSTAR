import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileClock,
  RefreshCw,
  ReceiptText,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getManagementDashboard,
  type ManagementDashboard,
} from '../../lib/managementApi'
import './ManagementDashboardPage.css'

interface Metric {
  label: string
  value: number
  icon: typeof Users
  href: string
  detail: string
}

export function ManagementDashboardPage() {
  const [dashboard, setDashboard] = useState<ManagementDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setDashboard(await getManagementDashboard())
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to load management dashboard.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    getManagementDashboard()
      .then((result) => {
        if (!mounted) return
        setDashboard(result)
        setLoading(false)
      })
      .catch((cause) => {
        if (!mounted) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load management dashboard.',
        )
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const metrics: Metric[] = dashboard
    ? [
        { label: 'Active customers', value: dashboard.active_customers, icon: Users, href: '/management/customers', detail: 'Customer records' },
        { label: 'Active accounts', value: dashboard.active_accounts, icon: Building2, href: '/management/accounts', detail: 'Banking accounts' },
        { label: 'Pending applications', value: dashboard.pending_applications, icon: ClipboardCheck, href: '/management/applications', detail: 'Awaiting review' },
        { label: 'Pending customers', value: dashboard.pending_customers, icon: Users, href: '/management/customers', detail: 'Awaiting activation' },
        { label: 'Pending transfers', value: dashboard.pending_transfers, icon: ReceiptText, href: '/management/operations', detail: 'Transfer instructions' },
        { label: 'Pending payments', value: dashboard.pending_payments, icon: CreditCard, href: '/management/operations', detail: 'Payment instructions' },
        { label: 'Open support tickets', value: dashboard.open_support_tickets, icon: Activity, href: '/management/support', detail: 'Customer service cases' },
        { label: 'Audit events · 24h', value: dashboard.audit_events_24h, icon: FileClock, href: '/management/audit', detail: 'Recorded control events' },
      ]
    : []

  return (
    <section className="management-dashboard" aria-busy={loading}>
      <header className="management-dashboard__header">
        <div>
          <span className="management-dashboard__eyebrow">NORTHSTARBANK / OPERATIONS</span>
          <h1>Management dashboard</h1>
          <p>Monitor customer services, banking operations, approvals and control activity.</p>
        </div>

        <div className="management-dashboard__header-actions">
          <button
            className="management-dashboard__refresh"
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
          >
            <RefreshCw size={15} />
            {loading ? 'Refreshing' : 'Refresh data'}
          </button>
          <Link className="management-dashboard__primary-action" to="/management/applications">
            Review applications <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      {loading && !dashboard ? (
        <div className="management-dashboard__state" role="status">
          <span className="management-dashboard__loader" />
          <strong>Loading management overview</strong>
          <span>Retrieving the latest available operational metrics.</span>
        </div>
      ) : error && !dashboard ? (
        <div className="management-dashboard__error" role="alert">
          <Activity size={22} />
          <strong>Dashboard data is unavailable</strong>
          <p>{error}</p>
          <button type="button" onClick={() => void loadDashboard()}>Try again</button>
        </div>
      ) : dashboard ? (
        <>
          {error && (
            <div className="management-dashboard__inline-error" role="status">
              Refresh failed. Showing the last successfully loaded figures. {error}
            </div>
          )}

          <div className="management-dashboard__section-heading">
            <div>
              <span>LIVE OVERVIEW</span>
              <h2>Institution snapshot</h2>
            </div>
            <span className="management-dashboard__data-status">
              <span /> {loading ? 'Updating figures' : 'Data loaded'}
            </span>
          </div>

          <div className="management-dashboard__metrics">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <Link className="management-dashboard__metric" to={metric.href} key={metric.label}>
                  <div className="management-dashboard__metric-top">
                    <div className="management-dashboard__metric-icon"><Icon size={19} /></div>
                    <ArrowRight size={15} className="management-dashboard__metric-arrow" />
                  </div>
                  <span className="management-dashboard__metric-label">{metric.label}</span>
                  <strong>{metric.value.toLocaleString()}</strong>
                  <span className="management-dashboard__metric-detail">{metric.detail}</span>
                </Link>
              )
            })}
          </div>

          <div className="management-dashboard__section-heading management-dashboard__section-heading--work">
            <div>
              <span>MANAGEMENT WORKSPACE</span>
              <h2>Priority work queues</h2>
            </div>
            <p>Open a queue to review and manage outstanding work.</p>
          </div>

          <div className="management-dashboard__lower">
            <section className="management-dashboard__panel">
              <div className="management-dashboard__panel-heading">
                <span>OPERATIONS & SERVICE</span>
                <h2>Items requiring attention</h2>
              </div>

              <div className="management-dashboard__queue">
                <Link to="/management/applications">
                  <span className="management-dashboard__queue-icon"><ClipboardCheck size={19} /></span>
                  <span className="management-dashboard__queue-copy">
                    <strong>Account applications</strong>
                    <span>Review new and pending customer applications.</span>
                  </span>
                  <span className="management-dashboard__queue-count">{dashboard.pending_applications.toLocaleString()}</span>
                  <ArrowRight size={16} />
                </Link>

                <Link to="/management/operations">
                  <span className="management-dashboard__queue-icon"><ReceiptText size={19} /></span>
                  <span className="management-dashboard__queue-copy">
                    <strong>Transfers & payments</strong>
                    <span>Review pending financial instructions.</span>
                  </span>
                  <span className="management-dashboard__queue-count">{(dashboard.pending_transfers + dashboard.pending_payments).toLocaleString()}</span>
                  <ArrowRight size={16} />
                </Link>

                <Link to="/management/support">
                  <span className="management-dashboard__queue-icon"><Activity size={19} /></span>
                  <span className="management-dashboard__queue-copy">
                    <strong>Customer support</strong>
                    <span>Follow up on unresolved customer cases.</span>
                  </span>
                  <span className="management-dashboard__queue-count">{dashboard.open_support_tickets.toLocaleString()}</span>
                  <ArrowRight size={16} />
                </Link>

                <Link to="/management/customers">
                  <span className="management-dashboard__queue-icon"><Users size={19} /></span>
                  <span className="management-dashboard__queue-copy">
                    <strong>Customer activation</strong>
                    <span>Review customers awaiting activation.</span>
                  </span>
                  <span className="management-dashboard__queue-count">{dashboard.pending_customers.toLocaleString()}</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </section>

            <section className="management-dashboard__panel management-dashboard__panel--secure">
              <div className="management-dashboard__shield"><ShieldCheck size={21} /></div>
              <span>SECURITY & GOVERNANCE</span>
              <h2>Accountability across every action.</h2>
              <p>Management access is permission-controlled. Administrative activity is recorded for oversight and audit review.</p>
              <div className="management-dashboard__secure-note">
                <CheckCircle2 size={16} />
                <span>Protected management workspace</span>
              </div>
              <Link to="/management/audit">Review audit log <ArrowRight size={16} /></Link>
            </section>
          </div>
        </>
      ) : null}
    </section>
  )
}
