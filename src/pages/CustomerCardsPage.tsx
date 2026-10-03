import {
  ArrowLeft,
  CreditCard,
  Lock,
  LockKeyholeOpen,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  getCustomerCards,
  getCustomerProfile,
  updateCustomerCardStatus,
} from "../lib/customerApi"
import type { BankCard, UserProfile } from "../types"
import "./CustomerCardsPage.css"

function formatExpiry(
  month: number | null,
  year: number | null,
) {
  if (!month || !year) {
    return "Not available"
  }

  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`
}

function formatAmount(
  amount: number,
  currency: string,
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

function formatCardType(cardType: string) {
  if (!cardType.trim()) {
    return "Card"
  }

  return cardType
    .trim()
    .split(/[\s_-]+/)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(" ")
}

function formatAccountType(accountType: string) {
  return accountType.charAt(0).toUpperCase() + accountType.slice(1)
}

function getStatusLabel(status: BankCard["status"]) {
  switch (status) {
    case "active":
      return "Active"
    case "locked":
      return "Locked"
    case "pending":
      return "Pending"
    case "expired":
      return "Expired"
    case "cancelled":
      return "Cancelled"
    default:
      return status
  }
}

function getCardholderName(profile: UserProfile | null) {
  if (!profile) {
    return "Cardholder"
  }

  const name = `${profile.firstName} ${profile.lastName}`.trim()

  return name || "Cardholder"
}

export function CustomerCardsPage() {
  const [cards, setCards] = useState<BankCard[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingCardId, setUpdatingCardId] = useState<string | null>(null)

  async function loadCards() {
    setLoading(true)
    setError(null)

    try {
      const [loadedCards, loadedProfile] = await Promise.all([
        getCustomerCards(),
        getCustomerProfile(),
      ])

      setCards(loadedCards)
      setProfile(loadedProfile)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your cards.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [loadedCards, loadedProfile] = await Promise.all([
          getCustomerCards(),
          getCustomerProfile(),
        ])

        if (cancelled) {
          return
        }

        setCards(loadedCards)
        setProfile(loadedProfile)
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your cards.",
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  async function toggleCard(card: BankCard) {
    if (card.status !== "active" && card.status !== "locked") {
      return
    }

    const nextStatus = card.status === "active" ? "locked" : "active"

    setUpdatingCardId(card.id)
    setError(null)

    try {
      const updatedCard = await updateCustomerCardStatus(
        card.id,
        nextStatus,
      )

      setCards((current) =>
        current.map((currentCard) =>
          currentCard.id === updatedCard.id
            ? {
                ...currentCard,
                ...updatedCard,
              }
            : currentCard,
        ),
      )
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update this card.",
      )
    } finally {
      setUpdatingCardId(null)
    }
  }

  return (
    <main className="customer-cards-page">
      <header className="customer-cards-header">
        <Link to="/customer" className="customer-cards-back">
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <span className="customer-cards-kicker">CARD SERVICES</span>

        <h1>Your cards</h1>

        <p>
          View your NorthStarBank cards and manage available card
          controls securely.
        </p>
      </header>

      <section className="customer-cards-security">
        <div className="customer-cards-security__icon">
          <ShieldCheck size={21} />
        </div>

        <div>
          <strong>Secure card controls</strong>
          <p>
            Card information shown here is limited to information
            stored for your customer profile. Full card numbers and
            security codes are never displayed.
          </p>
        </div>
      </section>

      {error && (
        <section className="customer-cards-info" role="alert">
          <div>
            <ShieldCheck size={20} />
          </div>

          <div>
            <strong>Unable to complete the request</strong>
            <p>{error}</p>

            <button
              type="button"
              className="customer-card__retry"
              onClick={() => void loadCards()}
              disabled={loading}
            >
              Try again
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <section className="customer-cards-list" aria-label="Loading cards">
          <article className="customer-card">
            <div className="customer-card__top">
              <div>
                <span className="customer-card__eyebrow">
                  CARD
                </span>
                <strong>Loading card information</strong>
              </div>
            </div>

            <div className="customer-card__loading">
              Loading your cards securely…
            </div>
          </article>
        </section>
      ) : cards.length === 0 ? (
        <section className="customer-cards-info">
          <div>
            <CreditCard size={20} />
          </div>

          <div>
            <strong>No cards available</strong>
            <p>
              There are currently no cards associated with your
              NorthStarBank customer profile.
            </p>
          </div>
        </section>
      ) : (
        <section
          className="customer-cards-list"
          aria-label="Customer cards"
        >
          {cards.map((card) => {
            const isLocked = card.status === "locked"
            const canToggle =
              card.status === "active" || card.status === "locked"
            const isUpdating = updatingCardId === card.id
            const linkedAccount = card.linkedAccount

            return (
              <article className="customer-card" key={card.id}>
                <div className="customer-card__top">
                  <div>
                    <span className="customer-card__eyebrow">
                      {formatCardType(card.cardType)}
                    </span>

                    <strong>
                      Card ending in {card.lastFour}
                    </strong>
                  </div>

                  <span
                    className={`customer-card__status${
                      isLocked
                        ? " customer-card__status--locked"
                        : ""
                    }`}
                  >
                    {getStatusLabel(card.status)}
                  </span>
                </div>

                <div
                  className={`customer-card__visual${
                    isLocked
                      ? " customer-card__visual--locked"
                      : ""
                  }`}
                >
                  <div className="customer-card__visual-top">
                    <span>NORTHSTAR BANK</span>
                    <CreditCard size={27} />
                  </div>

                  <div
                    className="customer-card__chip"
                    aria-hidden="true"
                  >
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="customer-card__number">
                    •••• •••• •••• {card.lastFour}
                  </div>

                  <div className="customer-card__visual-bottom">
                    <div>
                      <span>CARDHOLDER</span>
                      <strong>
                        {getCardholderName(profile)}
                      </strong>
                    </div>

                    <div>
                      <span>EXPIRES</span>
                      <strong>
                        {formatExpiry(
                          card.expiryMonth,
                          card.expiryYear,
                        )}
                      </strong>
                    </div>
                  </div>

                  {isLocked && (
                    <div className="customer-card__locked-overlay">
                      <Lock size={17} />
                      Card locked
                    </div>
                  )}
                </div>

                <div className="customer-card__balance">
                  <div>
                    <span>Card identifier</span>
                    <strong>•••• {card.lastFour}</strong>
                  </div>

                  <div>
                    <span>Expiration</span>
                    <strong>
                      {formatExpiry(
                        card.expiryMonth,
                        card.expiryYear,
                      )}
                    </strong>
                  </div>
                </div>

                {linkedAccount && (
                  <div className="customer-card__linked-account">
                    <div>
                      <span>Linked account</span>
                      <strong>
                        {formatAccountType(
                          linkedAccount.accountType,
                        )}{" "}
                        ••••{" "}
                        {linkedAccount.accountNumber.slice(-4)}
                      </strong>
                    </div>

                    <div>
                      <span>Available balance</span>
                      <strong>
                        {formatAmount(
                          linkedAccount.availableBalance,
                          linkedAccount.currency,
                        )}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="customer-card__actions">
                  {canToggle ? (
                    <button
                      type="button"
                      onClick={() => void toggleCard(card)}
                      disabled={isUpdating}
                    >
                      {isLocked ? (
                        <LockKeyholeOpen size={17} />
                      ) : (
                        <Lock size={17} />
                      )}

                      {isUpdating
                        ? "Updating…"
                        : isLocked
                          ? "Unlock card"
                          : "Lock card"}
                    </button>
                  ) : (
                    <span className="customer-card__unavailable">
                      Card controls unavailable
                    </span>
                  )}
                </div>

                <div className="customer-card__note">
                  <span>
                    <ShieldCheck size={14} />
                    Protected card information
                  </span>

                  <span>
                    {canToggle
                      ? "Status changes are recorded securely."
                      : "This card status cannot be changed here."}
                  </span>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
