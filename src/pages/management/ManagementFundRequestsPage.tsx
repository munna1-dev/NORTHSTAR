import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, RefreshCw, Wallet } from 'lucide-react'
import {
  getManagementFundRequests,
  reviewManagementFundRequest,
  type ManagementFundRequest,
} from '../../lib/managementApi'
import './ManagementDataPage.css'
import './ManagementFundRequestsPage.css'

function money(amount: string, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount))
}
function date(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ManagementFundRequestsPage() {
  const [items, setItems] = useState<ManagementFundRequest[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('open')
  const [references, setReferences] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setItems(await getManagementFundRequests()) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load fund requests.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  async function act(item: ManagementFundRequest, action: 'approve' | 'reject' | 'complete') {
    if (action === 'complete' && !references[item.id]?.trim()) {
      setError('Enter the verified receipt or payout reference before completing.')
      return
    }
    const prompt = action === 'complete'
      ? item.request_type === 'deposit'
        ? 'Confirm the deposit funds have actually been received and verified.'
        : 'Confirm the external withdrawal payout has actually been made.'
      : action === 'approve'
        ? 'Approve this withdrawal and reserve the funds from the available balance?'
        : 'Reject this request? An approved withdrawal reservation will be released.'
    if (!window.confirm(prompt)) return

    setBusy(item.id)
    setError('')
    setMessage('')
    try {
      await reviewManagementFundRequest(
        item.id, action, references[item.id]?.trim(), notes[item.id]?.trim(),
      )
      setMessage(`${item.reference} was ${action === 'complete' ? 'completed' : action + 'd'}.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process request.')
    } finally { setBusy('') }
  }

  const visible = items.filter((item) => {
    const matchesStatus = filter === 'all' ||
      (filter === 'open' ? ['pending', 'approved'].includes(item.status) : item.status === filter)
    const text = `${item.reference} ${item.first_name} ${item.last_name} ${item.email} ${item.account_number}`.toLowerCase()
    return matchesStatus && text.includes(search.toLowerCase())
  })

  return (
    <div className="management-data management-fund-requests">
      <header className="management-page-header">
        <div><span className="management-page-header__eyebrow">FINANCIAL OPERATIONS</span>
          <h1>Deposit & withdrawal requests</h1>
          <p>Review customer requests and record verified settlements.</p></div>
        <button className="management-button management-button--secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16}/> Refresh
        </button>
      </header>
      {error && <div className="management-data__error"><AlertCircle size={17}/>{error}</div>}
      {message && <div className="management-fund-requests__message">{message}</div>}
      <div className="management-data__toolbar">
        <label className="management-data__search"><Wallet size={16}/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, customer, email or account"/>
        </label>
        <select className="management-fund-requests__filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Pending & approved</option><option value="pending">Pending</option>
          <option value="approved">Approved</option><option value="completed">Completed</option>
          <option value="rejected">Rejected</option><option value="all">All requests</option>
        </select>
      </div>
      <section className="management-data__card">
        {loading ? <div className="management-data__empty"><RefreshCw/><span>Loading fund requests…</span></div> :
        visible.length === 0 ? <div className="management-data__empty"><Wallet size={30}/><strong>No matching fund requests</strong></div> :
        <div className="management-fund-requests__list">
          {visible.map((item) => (
            <article className="management-fund-requests__item" key={item.id}>
              <div className="management-fund-requests__top">
                <div><span className="management-fund-requests__type">{item.request_type}</span>
                  <h2>{money(item.amount, item.currency)}</h2><code>{item.reference}</code></div>
                <span className={`management-data__badge management-data__badge--${item.status}`}>{item.status}</span>
              </div>
              <div className="management-fund-requests__details">
                <div><small>Customer</small><strong>{item.first_name} {item.last_name}</strong><span>{item.customer_number} · {item.email}</span></div>
                <div><small>Account</small><strong>{item.account_number}</strong><span>Account status: {item.account_status}</span></div>
                <div><small>Submitted</small><strong>{date(item.created_at)}</strong><span>{item.description || 'Customer fund request'}</span></div>
                {item.request_type === 'deposit'
                  ? <div><small>Deposit details</small><strong>{item.deposit_method || 'Method not supplied'}</strong><span>Reference: {item.deposit_reference || 'Not supplied'}</span></div>
                  : <div><small>Beneficiary</small><strong>{item.beneficiary_name || 'Not supplied'}</strong><span>{item.beneficiary_bank || ''} · {item.beneficiary_account_number || ''}</span></div>}
              </div>
              {item.customer_note && <p className="management-fund-requests__note">Customer note: {item.customer_note}</p>}
              {item.review_notes && <p className="management-fund-requests__note">Review note: {item.review_notes}</p>}
              {(item.status === 'pending' || item.status === 'approved') && <>
                <div className="management-fund-requests__inputs">
                  <label>Review note<input value={notes[item.id] || ''} onChange={(e) => setNotes((v) => ({...v,[item.id]:e.target.value}))} maxLength={500} placeholder="Optional reviewer note"/></label>
                  {((item.request_type === 'deposit' && item.status === 'pending') ||
                    (item.request_type === 'withdrawal' && item.status === 'approved')) &&
                    <label>Verified settlement reference<input value={references[item.id] || ''} onChange={(e) => setReferences((v) => ({...v,[item.id]:e.target.value}))} maxLength={160} placeholder="Verified receipt / payout reference"/></label>}
                </div>
                <div className="management-fund-requests__actions">
                  {item.request_type === 'withdrawal' && item.status === 'pending' &&
                    <button disabled={!!busy} onClick={() => void act(item,'approve')}>Approve & reserve funds</button>}
                  {((item.request_type === 'deposit' && item.status === 'pending') ||
                    (item.request_type === 'withdrawal' && item.status === 'approved')) &&
                    <button disabled={!!busy} onClick={() => void act(item,'complete')}>
                      {item.request_type === 'deposit' ? 'Verify receipt & credit' : 'Confirm payout & settle'}
                    </button>}
                  <button className="management-fund-requests__reject" disabled={!!busy} onClick={() => void act(item,'reject')}>Reject</button>
                </div>
              </>}
              {item.settlement_reference && <p className="management-fund-requests__settlement">Settlement reference: {item.settlement_reference}</p>}
            </article>
          ))}
        </div>}
      </section>
    </div>
  )
}
