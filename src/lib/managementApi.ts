export interface ManagementDashboard {
  active_customers: number
  pending_customers: number
  active_accounts: number
  pending_applications: number
  open_support_tickets: number
  pending_transfers: number
  pending_payments: number
  audit_events_24h: number
}

export interface ManagementApplication {
  id: string
  customer_id: string | null
  account_type: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  review_notes: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  customer_number: string | null
  customer_status: string | null
}

async function request<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Management request failed.')
  }

  return payload as T
}

export async function getManagementDashboard(): Promise<ManagementDashboard> {
  const result = await request<{
    ok: true
    dashboard: ManagementDashboard
  }>('/api/management/dashboard')

  return result.dashboard
}

export async function getManagementApplications(
  status?: string,
): Promise<ManagementApplication[]> {
  const query = status
    ? `?status=${encodeURIComponent(status)}`
    : ''

  const result = await request<{
    ok: true
    applications: ManagementApplication[]
  }>(`/api/management/applications${query}`)

  return result.applications
}

export async function updateManagementApplication(
  applicationId: string,
  status: string,
  reviewNotes?: string,
): Promise<void> {
  await request('/api/management/applications', {
    method: 'PATCH',
    body: JSON.stringify({
      applicationId,
      status,
      reviewNotes,
    }),
  })
}

export interface ManagementCustomer {
  id: string
  customer_number: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  role: string
  two_factor_enabled: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
  account_count: number
  total_balance: string
}

export async function getManagementCustomers(
  status?: string,
  search?: string,
): Promise<ManagementCustomer[]> {
  const params = new URLSearchParams()

  if (status) {
    params.set('status', status)
  }

  if (search?.trim()) {
    params.set('search', search.trim())
  }

  const query = params.toString()
  const result = await request<{
    ok: true
    customers: ManagementCustomer[]
  }>(
    `/api/management/customers${query ? `?${query}` : ''}`,
  )

  return result.customers
}

export async function updateManagementCustomerStatus(
  customerId: string,
  status: string,
): Promise<ManagementCustomer> {
  const result = await request<{
    ok: true
    customer: ManagementCustomer
  }>('/api/management/customers', {
    method: 'PATCH',
    body: JSON.stringify({
      customerId,
      status,
    }),
  })

  return result.customer
}

export interface ManagementAccount {
  id: string
  account_number: string
  account_type: string
  status: string
  currency: string
  available_balance: string
  current_balance: string
  created_at: string
  updated_at: string
  customer_id: string
  customer_number: string
  first_name: string
  last_name: string
  email: string
}

export async function getManagementAccounts(
  status?: string,
  search?: string,
): Promise<ManagementAccount[]> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (search?.trim()) params.set('search', search.trim())

  const query = params.toString()
  const result = await request<{
    ok: true
    accounts: ManagementAccount[]
  }>(`/api/management/accounts${query ? `?${query}` : ''}`)

  return result.accounts
}

export async function updateManagementAccountStatus(
  accountId: string,
  status: string,
): Promise<ManagementAccount> {
  const result = await request<{
    ok: true
    account: ManagementAccount
  }>('/api/management/accounts', {
    method: 'PATCH',
    body: JSON.stringify({ accountId, status }),
  })

  return result.account
}

export interface ManagementTransaction {
  id: string
  transaction_reference: string
  transaction_type: string
  status: string
  amount: string
  currency: string
  description: string | null
  created_at: string
  account_number: string
  account_type: string
  customer_number: string
  first_name: string
  last_name: string
}

export async function getManagementTransactions(
  search?: string,
): Promise<ManagementTransaction[]> {
  const query = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : ''

  const result = await request<{
    ok: true
    transactions: ManagementTransaction[]
  }>(`/api/management/transactions${query}`)

  return result.transactions
}

export interface ManagementOperation {
  operation_type: 'transfer' | 'payment'
  id: string
  status: string
  amount: string
  currency: string
  description: string | null
  created_at: string
  account_number: string
  customer_number: string
  first_name: string
  last_name: string
}

export async function getManagementOperations(): Promise<
  ManagementOperation[]
> {
  const result = await request<{
    ok: true
    operations: ManagementOperation[]
  }>('/api/management/operations')

  return result.operations
}

export async function updateManagementOperation(
  operationType: 'transfer' | 'payment',
  operationId: string,
  status: string,
): Promise<ManagementOperation> {
  const result = await request<{
    ok: true
    operation: ManagementOperation
  }>('/api/management/operations', {
    method: 'PATCH',
    body: JSON.stringify({
      operationType,
      operationId,
      status,
    }),
  })

  return result.operation
}

export interface ManagementSupportTicket {
  id: string
  subject: string
  message: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  customer_id: string
  customer_number: string
  first_name: string
  last_name: string
  email: string
}

export async function getManagementSupportTickets(): Promise<
  ManagementSupportTicket[]
> {
  const result = await request<{
    ok: true
    tickets: ManagementSupportTicket[]
  }>('/api/management/support')

  return result.tickets
}

export async function updateManagementSupportTicket(
  ticketId: string,
  status: string,
): Promise<ManagementSupportTicket> {
  const result = await request<{
    ok: true
    ticket: ManagementSupportTicket
  }>('/api/management/support', {
    method: 'PATCH',
    body: JSON.stringify({
      ticketId,
      status,
    }),
  })

  return result.ticket
}

export interface ManagementAuditLog {
  id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  description: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor_customer_number: string | null
  actor_first_name: string | null
  actor_last_name: string | null
  actor_email: string | null
  actor_role: string | null
}

export async function getManagementAuditLogs(): Promise<
  ManagementAuditLog[]
> {
  const result = await request<{
    ok: true
    auditLogs: ManagementAuditLog[]
  }>('/api/management/audit')

  return result.auditLogs
}


export interface ManagementStaffApplication {
  id: string
  customer_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  employee_number: string | null
  requested_department: string | null
  requested_role: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  application_notes: string | null
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface ManagementStaffRole {
  id: string
  role_key: string
  role_name: string
  description: string | null
  is_system_role: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  staff_count: number
}

export interface ManagementPermission {
  id: string
  permission_key: string
  permission_name: string
  permission_group: string
  description: string | null
}

export interface ManagementStaffMember {
  id: string
  customer_number: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  role: string
  staff_status: string | null
  employee_number: string | null
  department: string | null
  approved_by: string | null
  approved_at: string | null
  blocked_by: string | null
  blocked_at: string | null
  block_reason: string | null
  created_at: string
  updated_at: string
  roles: Array<{
    id: string
    roleKey: string
    roleName: string
  }>
}

export async function getManagementStaffApplications(): Promise<
  ManagementStaffApplication[]
> {
  const result = await request<{
    applications: ManagementStaffApplication[]
  }>('/api/management/staff?section=applications')

  return result.applications
}

export async function getManagementStaffMembers(): Promise<
  ManagementStaffMember[]
> {
  const result = await request<{
    staff: ManagementStaffMember[]
  }>('/api/management/staff')

  return result.staff
}

export async function getManagementStaffRoles(): Promise<
  ManagementStaffRole[]
> {
  const result = await request<{
    roles: ManagementStaffRole[]
  }>('/api/management/staff?section=roles')

  return result.roles
}

export async function getManagementPermissions(): Promise<
  ManagementPermission[]
> {
  const result = await request<{
    permissions: ManagementPermission[]
  }>('/api/management/staff?section=permissions')

  return result.permissions
}

export async function reviewManagementStaffApplication(
  applicationId: string,
  action: 'approve-application' | 'reject-application',
  reviewNotes?: string,
): Promise<void> {
  await request('/api/management/staff', {
    method: 'PATCH',
    body: JSON.stringify({
      applicationId,
      action,
      reviewNotes,
    }),
  })
}

export async function updateManagementStaffStatus(
  customerId: string,
  action:
    | 'activate'
    | 'suspend'
    | 'block'
    | 'reactivate'
    | 'terminate',
  reason?: string,
): Promise<ManagementStaffMember> {
  const result = await request<{
    success: true
    staff: ManagementStaffMember
  }>('/api/management/staff', {
    method: 'PATCH',
    body: JSON.stringify({
      customerId,
      action,
      reason,
    }),
  })

  return result.staff
}

export async function assignManagementRole(
  customerId: string,
  roleKey: string,
): Promise<void> {
  await request('/api/management/staff', {
    method: 'POST',
    body: JSON.stringify({
      action: 'assign-role',
      customerId,
      roleKey,
    }),
  })
}

export async function assignManagementPermission(
  customerId: string,
  permissionKey: string,
  effect: 'allow' | 'deny',
): Promise<void> {
  await request('/api/management/staff', {
    method: 'POST',
    body: JSON.stringify({
      action: 'assign-permission',
      customerId,
      permissionKey,
      effect,
    }),
  })
}
