import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  getManagementKycDocumentFile,
  getManagementKycDocuments,
  updateManagementKycDocument,
  type ManagementKycDocument,
} from '../../lib/managementApi'
import { useManagementStaff } from '../../lib/managementStaffContext'
import './ManagementKycPage.css'

const FILTERS = [
  { value: '', label: 'All documents' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function customerName(document: ManagementKycDocument) {
  const name = [document.first_name, document.last_name].filter(Boolean).join(' ')
  return name || 'Customer record'
}

export function ManagementKycPage() {
  const staff = useManagementStaff()
  const canReview = staff?.role === 'super_manager' || Boolean(staff?.permissions?.includes('kyc.review'))
  const [documents, setDocuments] = useState<ManagementKycDocument[]>([])
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ManagementKycDocument | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadDocuments() {
    setLoading(true)
    setError('')
    try {
      const result = await getManagementKycDocuments(filter || undefined, search)
      setDocuments(result)
      if (selected) {
        const refreshed = result.find((item) => item.id === selected.id)
        setSelected(refreshed ?? null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load KYC documents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    getManagementKycDocuments(filter || undefined, search)
      .then((result) => {
        if (active) {
          setError('')
          setDocuments(result)
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load KYC documents.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [filter, search])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const visibleDocuments = useMemo(() => documents, [documents])

  function openDocument(document: ManagementKycDocument) {
    setSelected(document)
    setReviewNotes(document.review_notes ?? '')
    setNotice('')
    setError('')
    setPreviewUrl('')
  }

  async function viewPrivateFile() {
    if (!selected || previewLoading) return
    setPreviewLoading(true)
    setError('')
    try {
      const file = await getManagementKycDocumentFile(selected.id)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Unable to open the document.')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function downloadPrivateFile() {
    if (!selected) return
    setPreviewLoading(true)
    setError('')
    try {
      const file = await getManagementKycDocumentFile(selected.id)
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = selected.original_filename || 'kyc-document'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Unable to download the document.')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function decide(status: 'approved' | 'rejected') {
    if (!selected || saving) return
    if (status === 'rejected' && reviewNotes.trim().length < 3) {
      setError('Enter a rejection note of at least 3 characters.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await updateManagementKycDocument(
        selected.id,
        status,
        reviewNotes.trim() || undefined,
      )
      setNotice(`Document ${status} successfully. The customer profile verification status was not automatically changed.`)
      setSelected(null)
      setPreviewUrl('')
      await loadDocuments()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the review decision.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="management-kyc">
      <header className="management-page-header">
        <div>
          <span className="management-page-header__eyebrow">CUSTOMER COMPLIANCE</span>
          <h1>KYC Review</h1>
          <p>Review identity documents securely and record an auditable document-level decision.</p>
        </div>
        <button
          type="button"
          className="management-button management-button--secondary"
          onClick={() => void loadDocuments()}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {error && (
        <div className="management-alert management-alert--error">
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="management-alert management-alert--success">
          <CheckCircle2 size={18} /><span>{notice}</span>
        </div>
      )}

      <section className="management-kyc__toolbar">
        <div className="management-kyc__filters">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={filter === item.value ? 'management-filter management-filter--active' : 'management-filter'}
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
            placeholder="Search customer, email or filename"
            aria-label="Search KYC documents"
          />
        </label>
      </section>

      <section className="management-kyc__card">
        <div className="management-table-header">
          <div>
            <strong>Document queue</strong>
            <span>{visibleDocuments.length} document{visibleDocuments.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {loading ? (
          <div className="management-empty-state">
            <RefreshCw size={20} className="management-spin" />
            <span>Loading KYC documents…</span>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="management-empty-state">
            <FileCheck2 size={28} />
            <strong>No KYC documents found</strong>
            <span>Documents matching this filter will appear here.</span>
          </div>
        ) : (
          <div className="management-kyc__list">
            {visibleDocuments.map((item) => (
              <button
                type="button"
                className="management-kyc__item"
                key={item.id}
                onClick={() => openDocument(item)}
              >
                <span className="management-kyc__file-icon"><FileText size={20} /></span>
                <span className="management-kyc__item-main">
                  <strong>{customerName(item)}</strong>
                  <span>{humanize(item.document_type)} · {item.original_filename}</span>
                  <small>{item.customer_number || item.email || 'Customer'} · Uploaded {formatDate(item.uploaded_at)}</small>
                </span>
                <span className={`management-kyc__status management-kyc__status--${item.document_status}`}>
                  {item.document_status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="management-kyc__overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setSelected(null)
        }}>
          <section className="management-kyc__dialog" role="dialog" aria-modal="true" aria-labelledby="kyc-dialog-title">
            <header className="management-kyc__dialog-header">
              <div>
                <span className="management-page-header__eyebrow">DOCUMENT REVIEW</span>
                <h2 id="kyc-dialog-title">{humanize(selected.document_type)}</h2>
                <p>{customerName(selected)} · {selected.customer_number || 'No customer number'}</p>
              </div>
              <button type="button" className="management-kyc__close" onClick={() => setSelected(null)} disabled={saving}>×</button>
            </header>

            <div className="management-kyc__details">
              <div><span>Email</span><strong>{selected.email || 'Not available'}</strong></div>
              <div><span>Filename</span><strong>{selected.original_filename}</strong></div>
              <div><span>File type</span><strong>{selected.mime_type}</strong></div>
              <div><span>Uploaded</span><strong>{formatDate(selected.uploaded_at)}</strong></div>
              <div><span>Document status</span><strong>{humanize(selected.document_status)}</strong></div>
              <div><span>Customer KYC status</span><strong>{selected.customer_kyc_status || 'Not set'}</strong></div>
            </div>

            <div className="management-kyc__file-actions">
              <button type="button" className="management-button management-button--secondary" onClick={() => void viewPrivateFile()} disabled={previewLoading}>
                <FileText size={16} /> {previewLoading ? 'Loading…' : 'View private document'}
              </button>
              <button type="button" className="management-button management-button--secondary" onClick={() => void downloadPrivateFile()} disabled={previewLoading}>
                <Download size={16} /> Download
              </button>
            </div>

            {previewUrl && (
              <div className="management-kyc__preview">
                {selected.mime_type === 'application/pdf' ? (
                  <iframe src={previewUrl} title="Private KYC document preview" />
                ) : (
                  <img src={previewUrl} alt="Private KYC identity document" />
                )}
              </div>
            )}

            {selected.review_notes && (
              <div className="management-kyc__previous-note">
                <strong>Previous review note</strong>
                <p>{selected.review_notes}</p>
              </div>
            )}

            {selected.document_status === 'pending' && canReview ? (
              <div className="management-kyc__decision">
                <label htmlFor="kyc-review-notes">Review notes <span>(required for rejection)</span></label>
                <textarea
                  id="kyc-review-notes"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Record the reason for rejection or any review observations…"
                />
                <div className="management-kyc__decision-actions">
                  <button type="button" className="management-button management-button--danger" onClick={() => void decide('rejected')} disabled={saving}>
                    <XCircle size={16} /> Reject
                  </button>
                  <button type="button" className="management-button management-button--success" onClick={() => void decide('approved')} disabled={saving}>
                    <CheckCircle2 size={16} /> Approve document
                  </button>
                </div>
              </div>
            ) : (
              <div className="management-kyc__read-only">
                <ShieldCheck size={17} />
                {selected.document_status === 'pending'
                  ? 'You can view this document, but you do not have permission to approve or reject it.'
                  : 'This document has already been reviewed. Decisions are final in this queue.'}
                {selected.document_status !== 'pending' && selected.reviewed_at && (
                  <span> Reviewed {formatDate(selected.reviewed_at)}.</span>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
