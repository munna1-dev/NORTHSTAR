import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { RefreshCw, Wallet } from 'lucide-react'
import {
  getCustomerAccounts,
  getCustomerFundRequests,
  createCustomerFundRequest,
  type CustomerFundRequest,
} from '../lib/customerApi'
import type { BankAccount } from '../types'
import { formatCurrency, formatDateTime } from '../lib/format'
import './CustomerFundRequestsPage.css'

export function CustomerFundRequestsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [items, setItems] = useState<CustomerFundRequest[]>([])
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState('Bank transfer')
  const [depositReference, setDepositReference] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [beneficiaryBank, setBeneficiaryBank] = useState('')
  const [beneficiaryAccountNumber, setBeneficiaryAccountNumber] = useState('')
  const [beneficiaryRoutingCode, setBeneficiaryRoutingCode] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [accountRows, requestRows] = await Promise.all([
        getCustomerAccounts(),
        getCustomerFundRequests(),
      ])
      setAccounts(accountRows)
      setItems(requestRows)
      setAccountId((current) => current || accountRows[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load fund requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await createCustomerFundRequest({
        requestType: type,
        accountId,
        amount: amount.trim(),
        idempotencyKey: crypto.randomUUID(),
        ...(type === 'deposit'
          ? { depositMethod, depositReference: depositReference.trim() }
          : {
              beneficiaryName: beneficiaryName.trim(),
              beneficiaryBank: beneficiaryBank.trim(),
              beneficiaryAccountNumber: beneficiaryAccountNumber.trim(),
              beneficiaryRoutingCode: beneficiaryRoutingCode.trim(),
            }),
        customerNote: customerNote.trim(),
      })
      setAmount('')
      setDepositReference('')
      setBeneficiaryName('')
      setBeneficiaryBank('')
      setBeneficiaryAccountNumber('')
      setBeneficiaryRoutingCode('')
      setCustomerNote('')
      setMessage('Request submitted. Your account balance has not been changed.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="customer-funds">
      <header className="customer-funds__header">
        <div>
          <span>CUSTOMER BANKING</span>
          <h1>Deposits & withdrawals</h1>
          <p>Submit a request and track its review status.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      {error && <div className="customer-funds__alert customer-funds__alert--error" role="alert">{error}</div>}
      {message && <div className="customer-funds__alert" role="status">{message}</div>}

      <section className="customer-funds__panel">
        <div className="customer-funds__panel-title"><Wallet size={20} /><h2>New request</h2></div>
        <form onSubmit={(event) => void submit(event)} className="customer-funds__form">
          <label>Request type
            <select value={type} onChange={(e) => setType(e.target.value as 'deposit' | 'withdrawal')}>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </label>
          <label>Account
            <select required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountType} · {account.accountNumber} · {account.currency}
                </option>
              ))}
            </select>
          </label>
          <label>Amount
            <input required inputMode="decimal" type="number" min="0.01" step="0.01"
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </label>

          {type === 'deposit' ? <>
            <label>Deposit method
              <select value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>
                <option>Bank transfer</option>
                <option>Cash deposit</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </label>
            <label>Payment reference
              <input maxLength={160} value={depositReference}
                onChange={(e) => setDepositReference(e.target.value)} />
            </label>
          </> : <>
            <label>Beneficiary name
              <input required maxLength={160} value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} />
            </label>
            <label>Beneficiary bank
              <input required maxLength={160} value={beneficiaryBank} onChange={(e) => setBeneficiaryBank(e.target.value)} />
            </label>
            <label>Beneficiary account number
              <input required maxLength={80} value={beneficiaryAccountNumber} onChange={(e) => setBeneficiaryAccountNumber(e.target.value)} />
            </label>
            <label>Routing / bank code
              <input maxLength={80} value={beneficiaryRoutingCode} onChange={(e) => setBeneficiaryRoutingCode(e.target.value)} />
            </label>
          </>}
          <label className="customer-funds__wide">Note (optional)
            <textarea rows={3} maxLength={500} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
          </label>
          <p className="customer-funds__notice customer-funds__wide">
            Submitting a request does not immediately move money or change your account balance.
            Requests are subject to bank review.
          </p>
          <button className="customer-funds__submit customer-funds__wide" type="submit"
            disabled={saving || !accountId}>
            {saving ? 'Submitting…' : `Submit ${type} request`}
          </button>
        </form>
      </section>

      <section className="customer-funds__panel">
        <h2>Request history</h2>
        {loading ? <p>Loading requests…</p> : items.length === 0 ? (
          <p>No deposit or withdrawal requests yet.</p>
        ) : (
          <div className="customer-funds__history">
            {items.map((item) => (
              <article className="customer-funds__request" key={item.id}>
                <div>
                  <strong>{item.request_type} · {formatCurrency(Number(item.amount), item.currency)}</strong>
                  <span>{item.reference}</span>
                  <small>{formatDateTime(item.created_at)}</small>
                </div>
                <span className={`customer-funds__status customer-funds__status--${item.status}`}>
                  {item.status.replaceAll('_', ' ')}
                </span>
                {item.review_notes && <p className="customer-funds__wide">Review note: {item.review_notes}</p>}
                {item.settlement_reference && <small className="customer-funds__wide">Settlement reference: {item.settlement_reference}</small>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
