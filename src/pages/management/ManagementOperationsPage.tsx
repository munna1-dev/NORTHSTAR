import { AlertCircle, CreditCard, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  getManagementOperations,
  updateManagementOperation,
  type ManagementOperation,
} from '../../lib/managementApi'
import './ManagementDataPage.css'

function money(value: string, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value))
}

export function ManagementOperationsPage() {
  const [items, setItems] = useState<ManagementOperation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await getManagementOperations())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load operations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function decide(item: ManagementOperation, status: string) {
    if (!window.confirm(`${status} this ${item.operation_type}?`)) return
    try {
      await updateManagementOperation(item.operation_type, item.id, status)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update operation.')
    }
  }

  return (
    <div className="management-data">
      <header className="management-page-header">
        <div><span className="management-page-header__eyebrow">OPERATIONS CONTROL</span><h1>Transfers &amp; Payments</h1><p>Review pending internal transfer and payment instructions.</p></div>
        <button className="management-button management-button--secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error && <div className="management-data__error"><AlertCircle size={17} /> {error}</div>}

      <section className="management-data__card">
        {loading ? (
          <div className="management-data__empty"><RefreshCw className="management-spin" /><span>Loading operations…</span></div>
        ) : items.length === 0 ? (
          <div className="management-data__empty"><CreditCard size={30} /><strong>No operations found</strong></div>
        ) : (
          <div className="management-data__table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Customer</th><th>Account</th><th>Description</th><th>Status</th><th>Amount</th><th>Action</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.operation_type}-${item.id}`}>
                    <td>{item.operation_type}</td>
                    <td>{item.first_name} {item.last_name}<div className="management-data__secondary">{item.customer_number}</div></td>
                    <td>{item.account_number}</td>
                    <td>{item.description || '—'}</td>
                    <td><span className={`management-data__badge management-data__badge--${item.status}`}>{item.status}</span></td>
                    <td>{money(item.amount, item.currency)}</td>
                    <td>
                      {item.status === 'pending' ? (
                        <div className="management-data__actions">
                          <button className="management-button management-button--primary" onClick={() => void decide(item, 'completed')}>Complete</button>
                          <button className="management-button management-button--danger" onClick={() => void decide(item, 'failed')}>Fail</button>
                          <button className="management-button management-button--secondary" onClick={() => void decide(item, 'cancelled')}>Cancel</button>
                        </div>
                      ) : '—'}
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
