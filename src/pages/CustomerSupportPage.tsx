import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  LifeBuoy,
  MessageSquare,
  Send,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  createCustomerSupportTicket,
  getCustomerSupportTickets,
  type CustomerSupportTicket,
} from "../lib/customerApi"
import "./CustomerSupportPage.css"

const categories = [
  "Account access",
  "Payments",
  "Transfers",
  "Transactions",
  "Cards",
  "Other",
] as const

const faqs = [
  {
    question: "How do I review my account activity?",
    answer:
      "Open Transactions from your customer banking navigation to search and review posted account activity.",
  },
  {
    question: "How do I transfer between my accounts?",
    answer:
      "Open Transfers, choose the source and destination accounts, enter the amount, review the details, and submit.",
  },
  {
    question: "Where can I manage my preferences?",
    answer:
      "Open Settings to manage notification, regional, and transaction-display preferences.",
  },
  {
    question: "How do I secure my account?",
    answer:
      "Use the Security Center to review active sessions and revoke sessions you no longer recognize.",
  },
]

export function CustomerSupportPage() {
  const [tickets, setTickets] = useState<CustomerSupportTicket[]>([])
  const [category, setCategory] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState<CustomerSupportTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getCustomerSupportTickets()
      .then(setTickets)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load support requests.",
        ),
      )
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!category) {
      setError("Select a support category.")
      return
    }

    if (subject.trim().length < 3) {
      setError("Enter a subject.")
      return
    }

    if (message.trim().length < 10) {
      setError("Please provide at least 10 characters in your message.")
      return
    }

    setSending(true)

    try {
      const ticket = await createCustomerSupportTicket({
        category: category as (typeof categories)[number],
        subject,
        message,
      })

      setTickets((current) => [ticket, ...current])
      setSubmitted(ticket)
      setCategory("")
      setSubject("")
      setMessage("")
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to submit your request.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="customer-support-page">
      <header className="customer-support-header">
        <Link to="/customer" className="customer-support-back">
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <span className="customer-support-kicker">CUSTOMER SERVICE</span>
        <h1>How can we help?</h1>
        <p>
          Find answers or securely submit a customer service request.
        </p>
      </header>

      <div className="customer-support-grid">
        <section className="customer-support-card">
          <div className="customer-support-card__heading">
            <div className="customer-support-card__icon">
              <HelpCircle size={21} />
            </div>
            <div>
              <span className="customer-support-card__eyebrow">HELP CENTER</span>
              <h2>Frequently asked questions</h2>
            </div>
          </div>

          <div className="customer-support-faqs">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="customer-support-card">
          {!submitted ? (
            <>
              <div className="customer-support-card__heading">
                <div className="customer-support-card__icon">
                  <MessageSquare size={21} />
                </div>
                <div>
                  <span className="customer-support-card__eyebrow">
                    CUSTOMER REQUEST
                  </span>
                  <h2>Contact support</h2>
                </div>
              </div>

              <form
                className="customer-support-form"
                onSubmit={handleSubmit}
                noValidate
              >
                <label htmlFor="support-category">Category</label>
                <select
                  id="support-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="">Select a category</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>

                <label htmlFor="support-subject">Subject</label>
                <input
                  id="support-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="What do you need help with?"
                  maxLength={250}
                />

                <label htmlFor="support-message">Message</label>
                <textarea
                  id="support-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Describe your request..."
                  rows={6}
                  maxLength={5000}
                />

                <div className="customer-support-form__meta">
                  <span>{message.length}/5000</span>
                </div>

                {error && (
                  <p className="customer-support-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={sending}>
                  <Send size={17} />
                  {sending ? "Submitting…" : "Submit support request"}
                </button>
              </form>
            </>
          ) : (
            <div className="customer-support-success">
              <div className="customer-support-success__icon">
                <CheckCircle2 size={28} />
              </div>

              <span className="customer-support-card__eyebrow">
                REQUEST CREATED
              </span>

              <h2>Support request submitted</h2>
              <p>Your request has been securely recorded.</p>

              <div className="customer-support-reference">
                <span>Reference</span>
                <strong>{submitted.reference}</strong>
              </div>

              <button
                type="button"
                className="customer-support-secondary"
                onClick={() => setSubmitted(null)}
              >
                Submit another request
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="customer-support-card">
        <div className="customer-support-card__heading">
          <div className="customer-support-card__icon">
            <LifeBuoy size={21} />
          </div>
          <div>
            <span className="customer-support-card__eyebrow">MY REQUESTS</span>
            <h2>Support history</h2>
          </div>
        </div>

        {loading ? (
          <p>Loading your support requests…</p>
        ) : tickets.length === 0 ? (
          <p>No support requests have been submitted.</p>
        ) : (
          <div className="customer-support-faqs">
            {tickets.map((ticket) => (
              <details key={ticket.id}>
                <summary>
                  {ticket.reference} · {ticket.subject} · {ticket.status}
                </summary>
                <p>{ticket.message}</p>
              </details>
            ))}
          </div>
        )}
      </section>

      {error && !submitted && tickets.length > 0 && (
        <p className="customer-support-error" role="alert">{error}</p>
      )}
    </main>
  )
}
