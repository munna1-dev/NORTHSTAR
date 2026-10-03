import { AlertCircle, FileClock, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getManagementAuditLogs,
  type ManagementAuditLog,
} from '../../lib/managementApi'
import './ManagementDataPage.css'

export function ManagementAuditPage() {
  const [items, setItems] = useState<ManagementAuditLog[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await getManagementAuditLogs())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load audit log.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) =>
      [
        item.action,
        item.resource_type ?? '',
        item.description ?? '',
        item.actor_customer_number ?? '',
        item.actor_email ?? '',
      ].join(' ').toLowerCase().includes(q),
    )
  }, [items, search])

  return (
    <div className="management-data">
      <header className="management-page-header">
        <div><span className="management-page-header__eyebrow">CONTROL &amp; GOVERNANCE</span><h1>Audit Log</h1><p>Review recorded management activity and security events.</p></div>
        <button className="management-button management-button--secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error && <div className="management-data__error"><AlertCircle size={17} /> {error}</div>}

      <div className="management-data__toolbar">
        <label className="management-data__search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, actor or resource" /></label>
      </div>

      <section className="management-data__card">
        {loading ? (
          <div className="management-data__empty"><RefreshCw className="management-spin" /><span>Loading audit events…</span></div>
        ) : visible.length === 0 ? (
          <div className="management-data__empty"><FileClock size={30} /><strong>No audit events found</strong></div>
        ) : (
          <div className="management-data__table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Description</th><th>IP</th></tr></thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</td>
                    <td>{item.actor_first_name || 'System'} {item.actor_last_name || ''}<div className="management-data__secondary">{item.actor_customer_number || item.actor_email || '—'}</div></td>
                    <td><span className="management-data__badge management-data__badge--active">{item.action}</span></td>
                    <td>{item.resource_type || '—'}<div className="management-data__secondary">{item.resource_id || ''}</div></td>
                    <td>{item.description || '—'}</td>
                    <td>{item.ip_address || '—'}</td>
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
