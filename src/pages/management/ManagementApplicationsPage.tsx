import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FileText,
  RefreshCw,
  Search,
  UserRound,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  getManagementApplications,
  updateManagementApplication,
  type ManagementApplication,
} from '../../lib/managementApi'
import './ManagementApplicationsPage.css'

const FILTERS = [
  { value: '', label: 'All applications' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatAccountType(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export function ManagementApplicationsPage() {
  const [applications, setApplications] = useState<ManagementApplication[]>([])
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ManagementApplication | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadApplications() {
    setLoading(true)
    setError('')

    try {
      const result = await getManagementApplications(filter || undefined)
      setApplications(result)

      if (selected) {
        const refreshed = result.find((item) => item.id === selected.id)
        setSelected(refreshed ?? null)
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load account applications.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    getManagementApplications(filter || undefined)
      .then((result) => {
        if (!mounted) return

        setApplications(result)
      })
      .catch((loadError) => {
        if (!mounted) return

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load account applications.',
        )
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [filter])


  const visibleApplications = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return applications
    }

    return applications.filter((application) =>
      [
        application.first_name,
        application.last_name,
        application.email,
        application.phone ?? '',
        application.customer_number ?? '',
        application.account_type,
        application.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [applications, search])

  function openApplication(application: ManagementApplication) {
    setSelected(application)
    setReviewNotes(application.review_notes ?? '')
  }

  function closeApplication() {
    if (saving) return
    setSelected(null)
    setReviewNotes('')
  }

  async function changeStatus(status: string) {
    if (!selected || saving) return

    if (status === 'rejected' && !reviewNotes.trim()) {
      setError('A review note is required when rejecting an application.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await updateManagementApplication(
        selected.id,
        status,
        reviewNotes.trim() || undefined,
      )

      await loadApplications()
      setSelected(null)
      setReviewNotes('')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update the application.',
      )
    } finally {
      setSaving(false)
    }
  }

  const selectedIsFinal =
    selected?.status === 'approved' ||
    selected?.status === 'rejected' ||
    selected?.status === 'cancelled'

  return (
    <div className="management-applications">
      <header className="management-page-header">
        <div>
          <span className="management-page-header__eyebrow">
            ACCOUNT OPENING
          </span>
          <h1>Applications</h1>
          <p>
            Review customer account applications and record controlled
            management decisions.
          </p>
        </div>

        <button
          type="button"
          className="management-button management-button--secondary"
          onClick={() => void loadApplications()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="management-alert management-alert--error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="management-applications__toolbar">
        <div className="management-applications__filters">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={
                filter === item.value
                  ? 'management-filter management-filter--active'
                  : 'management-filter'
              }
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="management-search">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search applicant, email or customer number"
            aria-label="Search applications"
          />
        </label>
      </section>

      <section className="management-applications__card">
        <div className="management-table-header">
          <div>
            <strong>Application queue</strong>
            <span>
              {visibleApplications.length} application
              {visibleApplications.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="management-empty-state">
            <RefreshCw size={20} className="management-spin" />
            <span>Loading applications…</span>
          </div>
        ) : visibleApplications.length === 0 ? (
          <div className="management-empty-state">
            <ClipboardCheck size={28} />
            <strong>No applications found</strong>
            <span>There are no applications matching the current filters.</span>
          </div>
        ) : (
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Account</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleApplications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <div className="management-table__person">
                        <div className="management-table__avatar">
                          {application.first_name.charAt(0)}
                          {application.last_name.charAt(0)}
                        </div>
                        <div>
                          <strong>
                            {application.first_name} {application.last_name}
                          </strong>
                          <span>{application.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="management-table__primary">
                        {formatAccountType(application.account_type)}
                      </span>
                    </td>
                    <td>
                      {application.customer_number ? (
                        <span className="management-table__primary">
                          {application.customer_number}
                        </span>
                      ) : (
                        <span className="management-table__muted">
                          No customer
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`management-status management-status--${application.status}`}
                      >
                        {statusLabel(application.status)}
                      </span>
                    </td>
                    <td>
                      <span className="management-table__date">
                        {formatDate(application.created_at)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="management-icon-button"
                        onClick={() => openApplication(application)}
                        aria-label={`Review ${application.first_name} ${application.last_name}`}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="management-drawer-backdrop">
          <aside
            className="management-application-drawer"
            aria-label="Application review"
          >
            <div className="management-drawer__header">
              <div>
                <span className="management-page-header__eyebrow">
                  APPLICATION REVIEW
                </span>
                <h2>Review application</h2>
              </div>

              <button
                type="button"
                className="management-icon-button"
                onClick={closeApplication}
                disabled={saving}
                aria-label="Close application review"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="management-drawer__body">
              <section className="management-review-card">
                <div className="management-review-card__identity">
                  <div className="management-review-card__avatar">
                    {selected.first_name.charAt(0)}
                    {selected.last_name.charAt(0)}
                  </div>
                  <div>
                    <h3>
                      {selected.first_name} {selected.last_name}
                    </h3>
                    <p>{selected.email}</p>
                  </div>
                </div>

                <div className="management-review-grid">
                  <div>
                    <span>Account type</span>
                    <strong>
                      {formatAccountType(selected.account_type)}
                    </strong>
                  </div>
                  <div>
                    <span>Customer number</span>
                    <strong>
                      {selected.customer_number ?? 'Not linked'}
                    </strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{selected.phone ?? 'Not provided'}</strong>
                  </div>
                  <div>
                    <span>Submitted</span>
                    <strong>{formatDate(selected.created_at)}</strong>
                  </div>
                  <div>
                    <span>Application status</span>
                    <strong>{statusLabel(selected.status)}</strong>
                  </div>
                  <div>
                    <span>Customer status</span>
                    <strong>
                      {selected.customer_status ?? 'No customer record'}
                    </strong>
                  </div>
                </div>
              </section>

              {selected.status === 'approved' && (
                <div className="management-alert management-alert--success">
                  <CheckCircle2 size={18} />
                  <span>
                    This application was approved. The associated account
                    record is final.
                  </span>
                </div>
              )}

              {selected.status === 'rejected' && (
                <div className="management-alert management-alert--warning">
                  <XCircle size={18} />
                  <span>This application was rejected.</span>
                </div>
              )}

              {selected.status === 'cancelled' && (
                <div className="management-alert management-alert--warning">
                  <Clock3 size={18} />
                  <span>This application was cancelled.</span>
                </div>
              )}

              {!selectedIsFinal && !selected.customer_id && (
                <div className="management-alert management-alert--warning">
                  <UserRound size={18} />
                  <span>
                    No customer record is linked. Approval requires a customer
                    record to exist for this applicant.
                  </span>
                </div>
              )}

              <label className="management-field">
                <span>Review notes</span>
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Record the reason, verification result or operational note."
                  rows={6}
                  disabled={selectedIsFinal || saving}
                />
                <small>
                  A note is required when rejecting an application.
                </small>
              </label>

              <div className="management-drawer__actions">
                {!selectedIsFinal && selected.status === 'pending' && (
                  <button
                    type="button"
                    className="management-button management-button--secondary"
                    disabled={saving}
                    onClick={() => void changeStatus('under_review')}
                  >
                    <FileText size={16} />
                    Start review
                  </button>
                )}

                {!selectedIsFinal && (
                  <>
                    <button
                      type="button"
                      className="management-button management-button--danger"
                      disabled={saving}
                      onClick={() => void changeStatus('rejected')}
                    >
                      <XCircle size={16} />
                      Reject
                    </button>

                    <button
                      type="button"
                      className="management-button management-button--success"
                      disabled={saving || !selected.customer_id}
                      onClick={() => void changeStatus('approved')}
                    >
                      <CheckCircle2 size={16} />
                      Approve
                    </button>
                  </>
                )}

                {selected.status !== 'approved' &&
                  selected.status !== 'rejected' &&
                  selected.status !== 'cancelled' && (
                    <button
                      type="button"
                      className="management-button management-button--secondary"
                      disabled={saving}
                      onClick={() => void changeStatus('cancelled')}
                    >
                      Cancel application
                    </button>
                  )}
              </div>

              {saving && (
                <div className="management-saving">
                  <RefreshCw size={15} className="management-spin" />
                  Saving management decision…
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
