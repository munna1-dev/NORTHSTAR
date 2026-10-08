import type { VercelRequest, VercelResponse } from '@vercel/node'

import accounts from '../../src/server/api-handlers/management/accounts.js'
import applications from '../../src/server/api-handlers/management/applications.js'
import audit from '../../src/server/api-handlers/management/audit.js'
import customers from '../../src/server/api-handlers/management/customers.js'
import dashboard from '../../src/server/api-handlers/management/dashboard.js'
import operations from '../../src/server/api-handlers/management/operations.js'
import profile from '../../src/server/api-handlers/management/profile.js'
import staff from '../../src/server/api-handlers/management/staff/index.js'
import support from '../../src/server/api-handlers/management/support.js'
import transactions from '../../src/server/api-handlers/management/transactions.js'
import staffLogin from '../../src/server/api-handlers/staff/auth/login.js'
import staffLogout from '../../src/server/api-handlers/staff/auth/logout.js'
import staffMe from '../../src/server/api-handlers/staff/auth/me.js'
import health from '../../src/server/api-handlers/health.js'
import dbHealth from '../../src/server/api-handlers/db-health.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  const queryPath = typeof req.query.path === 'string' ? req.query.path : ''

  const parts = (queryPath || pathname)
    .replace(/^\/api\/management\/?/, '')
    .split('/')
    .filter(Boolean)

  const [resource] = parts

  if (resource === 'auth' && parts.length === 2) {
    if (parts[1] === 'login') return staffLogin(req, res)
    if (parts[1] === 'logout') return staffLogout(req, res)
    if (parts[1] === 'me') return staffMe(req, res)
  }

  if (resource === 'system' && parts.length === 2) {
    if (parts[1] === 'health') return health(req, res)
    if (parts[1] === 'db-health') return dbHealth(req, res)
  }

  if (resource === 'accounts' && parts.length === 1) {
    return accounts(req, res)
  }

  if (resource === 'applications' && parts.length === 1) {
    return applications(req, res)
  }

  if (resource === 'audit' && parts.length === 1) {
    return audit(req, res)
  }

  if (resource === 'customers' && parts.length === 1) {
    return customers(req, res)
  }

  if (resource === 'dashboard' && parts.length === 1) {
    return dashboard(req, res)
  }

  if (resource === 'operations' && parts.length === 1) {
    return operations(req, res)
  }

  if (resource === 'profile' && parts.length === 1) {
    return profile(req, res)
  }

  if (resource === 'staff') {
    return staff(req, res)
  }

  if (resource === 'support' && parts.length === 1) {
    return support(req, res)
  }

  if (resource === 'transactions' && parts.length === 1) {
    return transactions(req, res)
  }

  return res.status(404).json({
    ok: false,
    error: 'Management API route not found.',
  })
}
