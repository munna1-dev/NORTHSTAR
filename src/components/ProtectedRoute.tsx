import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentCustomer } from '../lib/session'
import type { UserProfile } from '../types'
import { CustomerShell } from './CustomerShell'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const [customer, setCustomer] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    void getCurrentCustomer().then((result) => {
      if (!mounted) {
        return
      }

      setCustomer(result)
      setLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <main
        style={{
          minHeight: '60vh',
          display: 'grid',
          placeItems: 'center',
          padding: '40px 20px',
        }}
      >
        <p>Verifying your secure session…</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return (
    <CustomerShell customer={customer}>
      {children}
    </CustomerShell>
  )
}
