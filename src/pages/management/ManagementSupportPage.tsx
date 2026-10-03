import { AlertCircle, MessageSquare, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  getManagementSupportTickets,
  updateManagementSupportTicket,
  type ManagementSupportTicket,
} from '../../lib/managementApi'
import './ManagementDataPage.css'

export function ManagementSupportPage() {
  const [items, setItems] = useState<ManagementSupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await getManagementSupportTickets())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load support tickets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function changeStatus(item: ManagementSupportTicket, status: string) {
    if (!window.confirm(`Move this ticket to ${status}?`)) return
    try {
      await updateManagementSupportTicket(item.id, status)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update ticket.')
    }
  }

  return (
    <div className="management-data">
      <header className="management-page-header">
        <div><span className="management-page-header__eyebrow">CUSTOMER CARE</span><h1>Support</h1><p>Prioritize and manage customer support requests.</p></div>
        <button className="management-button management-button--secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error && <div className="management-data__error"><AlertCircle size={17} /> {error}</div>}

      <section className="management-data__card">
        {loading ? (
          <div className="management-data__empty"><RefreshCw className="management-spin" /><span>Loading support queue…</span></div>
        ) : items.length === 0 ? (
          <div className="management-data__empty"><MessageSquare size={30} /><strong>No support tickets</strong></div>
        ) : (
          <div className="management-data__table-wrap">
            <table>
              <thead><tr><th>Priority</th><th>Ticket</th><th>Customer</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><span className={`management-data__badge management-data__badge--${item.priority === 'urgent' || item.priority === 'high' ? 'failed' : 'pending'}`}>{item.priority}</span></td>
                    <td><div className="management-data__primary">{item.subject}</div><div className="management-data__secondary">{item.message}</div></td>
                    <td>{item.first_name} {item.last_name}<div className="management-data__secondary">{item.customer_number}</div></td>
                    <td><span className={`management-data__badge management-data__badge--${item.status}`}>{item.status.replace('_', ' ')}</span></td>
                    <td>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.created_at))}</td>
                    <td>
                      {item.status === 'open' && <button className="management-button management-button--primary" onClick={() => void changeStatus(item, 'in_progress')}>Take case</button>}
                      {item.status === 'in_progress' && <button className="management-button management-button--primary" onClick={() => void changeStatus(item, 'resolved')}>Resolve</button>}
                      {item.status === 'resolved' && <button className="management-button management-button--secondary" onClick={() => void changeStatus(item, 'closed')}>Close</button>}
                      {item.status === 'closed' && '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
