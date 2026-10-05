import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getSessionExpiredEventName,
  notifySessionExpired,
  resumeSessionSecurity,
  startSessionSecurity,
} from '../lib/sessionSecurity'
import { signOutCustomer } from '../lib/session'

export function SessionSecurity() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    return startSessionSecurity()
  }, [])

  useEffect(() => {
    resumeSessionSecurity()
  }, [location.pathname])

  useEffect(() => {
    const eventName = getSessionExpiredEventName()

    const handleExpired = async () => {
      if (
        !location.pathname.startsWith('/customer') &&
        !location.pathname.startsWith('/management')
      ) {
        return
      }

      const from = `${location.pathname}${location.search}${location.hash}`

      await signOutCustomer()

      navigate('/signin', {
        replace: true,
        state: {
          from,
          sessionExpired: true,
        },
      })
    }

    window.addEventListener(eventName, handleExpired)

    return () => {
      window.removeEventListener(eventName, handleExpired)
    }
  }, [location.hash, location.pathname, location.search, navigate])

  useEffect(() => {
    const handleUnauthorized = () => {
      notifySessionExpired()
    }

    window.addEventListener(
      'northstar:auth-unauthorized',
      handleUnauthorized,
    )

    return () => {
      window.removeEventListener(
        'northstar:auth-unauthorized',
        handleUnauthorized,
      )
    }
  }, [])

  return null
}
