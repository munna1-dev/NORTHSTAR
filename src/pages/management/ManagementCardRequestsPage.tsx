import { useCallback, useEffect, useState } from 'react'
import {
  getManagementCardRequests,
  reviewManagementCardRequest,
  type ManagementCardRequest,
} from '../../lib/managementApi'

export function ManagementCardRequestsPage() {
  const [requests, setRequests] = useState<ManagementCardRequest[]>([])
  const [filter, setFilter] = useState('pending')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await getManagementCardRequests(filter || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load card requests.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    let cancelled = false

    async function loadFilteredRequests() {
      try {
        const result = await getManagementCardRequests(filter || undefined)
        if (!cancelled) {
          setRequests(result)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load card requests.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadFilteredRequests()

    return () => {
      cancelled = true
    }
  }, [filter])

  async function review(item: ManagementCardRequest, status: 'approved' | 'rejected') {
    const reviewNotes = (notes[item.id] ?? '').trim()

    if (status === 'rejected' && reviewNotes.length < 3) {
      setError('Enter a review reason of at least 3 characters before rejecting.')
      return
    }

    setSavingId(item.id)
    setError('')
    setMessage('')

    try {
      await reviewManagementCardRequest(item.id, status, reviewNotes || undefined)
      setMessage(`Request ${status}. No card has been issued.`)
      await loadRequests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to review this request.')
    } finally {
      setSavingId('')
    }
  }

  return (
    <section className="management-card-requests">
      <header>
        <h1>Card Requests</h1>
        <p>Review customer requests. Approval does not issue a card.</p>
      </header>

      <div className="management-card-requests__toolbar">
        <label>
          Request status
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="pending">Pending review</option>
            <option value="">All requests</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="issued">Issued</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button type="button" onClick={() => void loadRequests()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <p role="alert" className="management-card-requests__error">{error}</p>}
      {message && <p role="status" className="management-card-requests__message">{message}</p>}
      {loading && <p>Loading card requests…</p>}
      {!loading && requests.length === 0 && <p>No card requests found for this filter.</p>}

      <div className="management-card-requests__list">
        {requests.map((item) => (
          <article className="management-card-requests__item" key={item.id}>
            <div className="management-card-requests__heading">
              <div>
                <h2>{item.first_name} {item.last_name}</h2>
                <p>{item.email} · Customer {item.customer_number}</p>
              </div>
              <span className={`management-card-requests__status management-card-requests__status--${item.status}`}>
                {item.status.replace(/_/g, ' ')}
              </span>
            </div>

            <dl>
              <div><dt>Card type</dt><dd>{item.card_category}</dd></div>
              <div><dt>Format</dt><dd>{item.card_format}</dd></div>
              <div><dt>Linked account</dt><dd>{item.account_number || 'Not specified'}</dd></div>
              <div><dt>Submitted</dt><dd>{new Date(item.created_at).toLocaleString()}</dd></div>
            </dl>

            {item.customer_notes && (
              <p><strong>Customer notes:</strong> {item.customer_notes}</p>
            )}
            {item.review_notes && (
              <p><strong>Review note:</strong> {item.review_notes}</p>
            )}

            {item.status === 'pending' && (
              <div className="management-card-requests__review">
                <label>
                  Review note
                  <textarea
                    value={notes[item.id] ?? ''}
                    maxLength={1000}
                    onChange={(event) => setNotes((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))}
                    placeholder="Optional for approval; required for rejection"
                  />
                </label>
                <div className="management-card-requests__actions">
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => void review(item, 'approved')}
                  >
                    {savingId === item.id ? 'Saving…' : 'Approve request'}
                  </button>
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => void review(item, 'rejected')}
                  >
                    Reject request
                  </button>
                </div>
              </div>
            )}

            {item.status === 'approved' && (
              <p>Approved for the separate card-issuance process. No card was created by this review.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
