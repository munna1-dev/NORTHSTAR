import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentCustomer } from '../lib/session'
import type { UserProfile } from '../types'
import { ManagementShell } from './ManagementShell'

interface ManagementRouteProps {
  children: ReactNode
  permission?: string
  permissions?: string[]
  superManagerOnly?: boolean
}

export function ManagementRoute({
  children,
  permission,
  permissions,
  superManagerOnly = false,
}: ManagementRouteProps) {
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
      <main className="management-route-loading">
        <p>Verifying your management session…</p>
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

  const customerRole = customer.role as string

  if (
    customerRole !== 'staff' &&
    customerRole !== 'management' &&
    customerRole !== 'developer' &&
    customerRole !== 'super_manager'
  ) {
    return <Navigate to="/customer" replace />
  }

  if (superManagerOnly && customerRole !== 'super_manager') {
    return <Navigate to="/management" replace />
  }

  if (customerRole !== 'super_manager') {
    const grantedPermissions = customer.permissions ?? []

    if (
      permission &&
      !grantedPermissions.includes(permission)
    ) {
      return <Navigate to="/management" replace />
    }

    if (
      permissions?.length &&
      !permissions.some((item) =>
        grantedPermissions.includes(item),
      )
    ) {
      return <Navigate to="/management" replace />
    }
  }

  return (
    <ManagementShell customer={customer}>
      {children}
    </ManagementShell>
  )
}
