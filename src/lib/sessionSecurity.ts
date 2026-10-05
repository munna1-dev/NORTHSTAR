const SESSION_TIMEOUT_MS = 15 * 60 * 1000
const SESSION_EXPIRED_EVENT = 'northstar:session-expired'

let lastActivityAt = Date.now()
let timeoutId: number | null = null
let started = false
let handlingExpiry = false

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/customer') ||
    pathname.startsWith('/management')
  )
}

function dispatchSessionExpired(): void {
  if (handlingExpiry) {
    return
  }

  handlingExpiry = true

  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT),
  )
}

function scheduleExpiry(): void {
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId)
  }

  const elapsed = Date.now() - lastActivityAt
  const remaining = Math.max(SESSION_TIMEOUT_MS - elapsed, 0)

  timeoutId = window.setTimeout(() => {
    if (!isProtectedPath(window.location.pathname)) {
      timeoutId = null
      return
    }

    const idleFor = Date.now() - lastActivityAt

    if (idleFor >= SESSION_TIMEOUT_MS) {
      dispatchSessionExpired()
      return
    }

    scheduleExpiry()
  }, Math.max(remaining, 250))
}

function recordActivity(): void {
  if (!isProtectedPath(window.location.pathname)) {
    return
  }

  lastActivityAt = Date.now()
  handlingExpiry = false
  scheduleExpiry()
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    const idleFor = Date.now() - lastActivityAt

    if (
      isProtectedPath(window.location.pathname) &&
      idleFor >= SESSION_TIMEOUT_MS
    ) {
      dispatchSessionExpired()
      return
    }

    recordActivity()
  }
}

export function startSessionSecurity(): () => void {
  if (started) {
    return () => undefined
  }

  started = true

  const activityEvents: Array<keyof WindowEventMap> = [
    'pointerdown',
    'keydown',
    'touchstart',
    'scroll',
  ]

  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, recordActivity, {
      passive: true,
    })
  })

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange,
  )

  scheduleExpiry()

  return () => {
    activityEvents.forEach((eventName) => {
      window.removeEventListener(eventName, recordActivity)
    })

    document.removeEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }

    started = false
  }
}

export function notifySessionExpired(): void {
  dispatchSessionExpired()
}

export function resumeSessionSecurity(): void {
  if (isProtectedPath(window.location.pathname)) {
    scheduleExpiry()
  }
}

export function getSessionExpiredEventName(): string {
  return SESSION_EXPIRED_EVENT
}

export function resetSessionActivity(): void {
  lastActivityAt = Date.now()
  handlingExpiry = false
  scheduleExpiry()
}
