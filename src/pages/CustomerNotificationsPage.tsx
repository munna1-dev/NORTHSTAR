import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  CircleDollarSign,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from "../lib/customerApi"
import type {
  CustomerNotification,
  NotificationType,
} from "../types"
import "./CustomerNotificationsPage.css"

type Filter = "all" | "unread" | NotificationType

function notificationIcon(type: NotificationType) {
  if (type === "transaction") {
    return <CircleDollarSign size={19} />
  }

  if (type === "transfer") {
    return <CheckCheck size={19} />
  }

  if (type === "security") {
    return <ShieldAlert size={19} />
  }

  return <Bell size={19} />
}

function notificationLabel(type: NotificationType) {
  if (type === "transaction") return "Transaction"
  if (type === "transfer") return "Transfer"
  if (type === "security") return "Security"
  return "Account"
}

function formatNotificationDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function CustomerNotificationsPage() {
  const [notifications, setNotifications] = useState<
    CustomerNotification[]
  >([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<Filter>("all")
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadNotifications() {
    setLoading(true)
    setError(null)

    try {
      const result = await getCustomerNotifications()

      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your notifications.",
      )
    } finally {
      setLoading(false)
    }
  }


	  useEffect(() => {
    let cancelled = false

    async function fetchNotifications() {
      setLoading(true)
      setError(null)

      try {
        const result = await getCustomerNotifications()

        if (cancelled) {
          return
        }

        setNotifications(result.notifications)
        setUnreadCount(result.unreadCount)
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your notifications.",
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchNotifications()

    return () => {
      cancelled = true
    }
  }, [])
	

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === "all") return true
      if (filter === "unread") return notification.unread
      return notification.type === filter
    })
  }, [filter, notifications])

  async function markAsRead(id: string) {
    const notification = notifications.find(
      (item) => item.id === id,
    )

    if (!notification || !notification.unread) {
      return
    }

    setUpdatingId(id)
    setError(null)

    try {
      const updated = await markCustomerNotificationRead(id, true)

      setNotifications((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      )

      setUnreadCount((current) => Math.max(0, current - 1))
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to mark this notification as read.",
      )
    } finally {
      setUpdatingId(null)
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0 || markingAll) {
      return
    }

    setMarkingAll(true)
    setError(null)

    try {
      const changed = await markAllCustomerNotificationsRead()

      if (changed > 0) {
        setNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            unread: false,
          })),
        )
      }

      setUnreadCount(0)
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to mark notifications as read.",
      )
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <main className="customer-notifications-page">
      <header className="customer-notifications-header">
        <Link to="/customer" className="customer-notifications-back">
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <span className="customer-notifications-kicker">
          CUSTOMER ALERTS
        </span>

        <div className="customer-notifications-title-row">
          <div>
            <h1>Notifications</h1>
            <p>
              Review account, transaction, transfer, and security
              alerts associated with your NorthStarBank account.
            </p>
          </div>

          <div className="customer-notifications-count">
            <Bell size={18} />
            <strong>{unreadCount}</strong>
            <span>unread</span>
          </div>
        </div>
      </header>

      <section className="customer-notifications-toolbar">
        <div
          className="customer-notifications-filters"
          aria-label="Notification filters"
        >
          {(
            [
              ["all", "All"],
              ["unread", "Unread"],
              ["transaction", "Transactions"],
              ["transfer", "Transfers"],
              ["security", "Security"],
              ["account", "Account"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={
                filter === value
                  ? "customer-notifications-filter customer-notifications-filter--active"
                  : "customer-notifications-filter"
              }
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="customer-notifications-mark-all"
            onClick={() => void markAllAsRead()}
            disabled={markingAll}
          >
            {markingAll ? (
              <RefreshCw size={16} className="customer-notifications-spin" />
            ) : (
              <CheckCheck size={16} />
            )}
            {markingAll ? "Updating..." : "Mark all as read"}
          </button>
        )}
      </section>

      {error && (
        <section
          className="customer-notifications-error"
          role="alert"
        >
          <AlertTriangle size={18} />

          <div>
            <strong>Notifications could not be updated</strong>
            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={() => void loadNotifications()}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </section>
      )}

      <section
        className="customer-notifications-list"
        aria-label="Notifications"
      >
        {loading ? (
          <div className="customer-notifications-empty">
            <div className="customer-notifications-empty__icon">
              <RefreshCw
                size={25}
                className="customer-notifications-spin"
              />
            </div>

            <h2>Loading notifications</h2>

            <p>
              Retrieving your latest account alerts securely.
            </p>
          </div>
        ) : filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => (
            <article
              className={`customer-notification${
                notification.unread
                  ? " customer-notification--unread"
                  : ""
              }`}
              key={notification.id}
            >
              <div className="customer-notification__icon">
                {notificationIcon(notification.type)}
              </div>

              <div className="customer-notification__body">
                <div className="customer-notification__heading">
                  <div>
                    <span className="customer-notification__type">
                      {notificationLabel(notification.type)}
                    </span>

                    <h2>{notification.title}</h2>
                  </div>

                  {notification.unread && (
                    <span className="customer-notification__unread">
                      New
                    </span>
                  )}
                </div>

                <p>{notification.message}</p>

                <time dateTime={notification.createdAt}>
                  {formatNotificationDate(notification.createdAt)}
                </time>
              </div>

              {notification.unread && (
                <div className="customer-notification__actions">
                  <button
                    type="button"
                    onClick={() =>
                      void markAsRead(notification.id)
                    }
                    disabled={updatingId === notification.id}
                    title="Mark as read"
                    aria-label={`Mark ${notification.title} as read`}
                  >
                    {updatingId === notification.id ? (
                      <RefreshCw
                        size={17}
                        className="customer-notifications-spin"
                      />
                    ) : (
                      <Check size={17} />
                    )}
                    <span>Mark read</span>
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="customer-notifications-empty">
            <div className="customer-notifications-empty__icon">
              <Bell size={25} />
            </div>

            <h2>No notifications</h2>

            <p>
              {filter === "all"
                ? "There are currently no notifications for your account."
                : "There are no notifications matching the selected filter."}
            </p>

            {filter !== "all" && (
              <button type="button" onClick={() => setFilter("all")}>
                View all notifications
              </button>
            )}
          </div>
        )}
      </section>

      <section className="customer-notifications-security">
        <div className="customer-notifications-security__icon">
          <LockKeyhole size={20} />
        </div>

        <div>
          <strong>Security alerts</strong>
          <p>
            Security and account activity notifications shown here
            are retrieved from your authenticated NorthStarBank
            customer record.
          </p>
        </div>
      </section>

      <section className="customer-notifications-note">
        <AlertTriangle size={18} />
        <p>
          <strong>Notification availability.</strong> This page
          displays notifications recorded by the NorthStarBank
          backend. Delivery through separate SMS, email, or push
          channels is not represented unless those services are
          configured independently.
        </p>
      </section>
    </main>
  )
}
