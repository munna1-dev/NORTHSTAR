import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react'
import {
  assignManagementPermission,
  assignManagementRole,
  getManagementPermissions,
  getManagementStaffApplications,
  getManagementStaffMembers,
  getManagementStaffRoles,
  reviewManagementStaffApplication,
  updateManagementStaffStatus,
  type ManagementPermission,
  type ManagementStaffApplication,
  type ManagementStaffMember,
  type ManagementStaffRole,
} from '../../lib/managementApi'
import './ManagementStaffPage.css'

type Tab = 'applications' | 'staff' | 'roles'

const lifecycleActions = [
  { value: 'activate', label: 'Activate' },
  { value: 'suspend', label: 'Suspend' },
  { value: 'block', label: 'Block' },
  { value: 'reactivate', label: 'Reactivate' },
  { value: 'terminate', label: 'Terminate' },
] as const

type LifecycleAction = (typeof lifecycleActions)[number]['value']

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusLabel(value: string | null) {
  if (!value) return 'Not assigned'
  return value.replaceAll('_', ' ')
}

export default function ManagementStaffPage() {
  const [tab, setTab] = useState<Tab>('applications')
  const [applications, setApplications] = useState<ManagementStaffApplication[]>([])
  const [staff, setStaff] = useState<ManagementStaffMember[]>([])
  const [roles, setRoles] = useState<ManagementStaffRole[]>([])
  const [permissions, setPermissions] = useState<ManagementPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [reviewId, setReviewId] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [roleCustomerId, setRoleCustomerId] = useState('')
  const [roleKey, setRoleKey] = useState('')
  const [permissionCustomerId, setPermissionCustomerId] = useState('')
  const [permissionKey, setPermissionKey] = useState('')
  const [permissionEffect, setPermissionEffect] = useState<'allow' | 'deny'>('allow')
  const [lifecycleCustomerId, setLifecycleCustomerId] = useState('')
  const [lifecycleAction, setLifecycleAction] =
    useState<LifecycleAction>('activate')
  const [lifecycleReason, setLifecycleReason] = useState('')

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === 'pending'),
    [applications],
  )

  const activeStaff = useMemo(
    () => staff.filter((member) => member.staff_status === 'active').length,
    [staff],
  )

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [
        applicationData,
        staffData,
        roleData,
        permissionData,
      ] = await Promise.all([
        getManagementStaffApplications(),
        getManagementStaffMembers(),
        getManagementStaffRoles(),
        getManagementPermissions(),
      ])

      setApplications(applicationData)
      setStaff(staffData)
      setRoles(roleData)
      setPermissions(permissionData)

      if (!roleKey && roleData.length > 0) {
        setRoleKey(roleData.find((role) => role.role_key !== 'super_manager')?.role_key ?? roleData[0].role_key)
      }

      if (!permissionKey && permissionData.length > 0) {
        setPermissionKey(permissionData[0].permission_key)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load staff controls.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const initialise = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          applicationData,
          staffData,
          roleData,
          permissionData,
        ] = await Promise.all([
          getManagementStaffApplications(),
          getManagementStaffMembers(),
          getManagementStaffRoles(),
          getManagementPermissions(),
        ])

        if (cancelled) return

        setApplications(applicationData)
        setStaff(staffData)
        setRoles(roleData)
        setPermissions(permissionData)

        if (!roleKey && roleData.length > 0) {
          setRoleKey(
            roleData.find((role) => role.role_key !== 'super_manager')?.role_key ??
              roleData[0].role_key,
          )
        }

        if (!permissionKey && permissionData.length > 0) {
          setPermissionKey(permissionData[0].permission_key)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load staff controls.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void initialise()

    return () => {
      cancelled = true
    }
  }, [permissionKey, roleKey])

  const runAction = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key)
    setError('')
    setMessage('')

    try {
      await action()
      setMessage('Staff control action completed successfully.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The requested action failed.')
    } finally {
      setBusyKey('')
    }
  }

  const reviewApplication = async (
    application: ManagementStaffApplication,
    action: 'approve' | 'reject',
  ) => {
    if (action === 'reject' && reviewNotes.trim().length < 3) {
      setError('Enter a review note of at least 3 characters before rejecting.')
      return
    }

    await runAction(`review-${application.id}`, async () => {
      await reviewManagementStaffApplication(
        application.id,
        action === 'approve' ? 'approve-application' : 'reject-application',
        reviewNotes.trim() || undefined,
      )
      setReviewId('')
      setReviewNotes('')
    })
  }

  const applyRole = async () => {
    if (!roleCustomerId || !roleKey) {
      setError('Select a staff member and a role.')
      return
    }

    await runAction('assign-role', async () => {
      await assignManagementRole(roleCustomerId, roleKey)
      setRoleCustomerId('')
    })
  }

  const applyPermission = async () => {
    if (!permissionCustomerId || !permissionKey) {
      setError('Select a staff member and a permission.')
      return
    }

    await runAction('assign-permission', async () => {
      await assignManagementPermission(
        permissionCustomerId,
        permissionKey,
        permissionEffect,
      )
      setPermissionCustomerId('')
    })
  }

  const applyLifecycle = async () => {
    if (!lifecycleCustomerId) {
      setError('Select a staff member.')
      return
    }

    await runAction('lifecycle', async () => {
      await updateManagementStaffStatus(
        lifecycleCustomerId,
        lifecycleAction,
        lifecycleReason.trim() || undefined,
      )
      setLifecycleCustomerId('')
      setLifecycleReason('')
    })
  }

  return (
    <div className="management-staff">
      <section className="management-staff__hero">
        <div>
          <span className="management-eyebrow">
            <ShieldCheck size={15} />
            Super Manager Control Center
          </span>
          <h1>Staff Control</h1>
          <p>
            Manage staff applications, workforce status, roles, and granular
            permissions from one controlled workspace.
          </p>
        </div>

        <button
          className="management-button management-button--secondary"
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
          Refresh
        </button>
      </section>

      {error && (
        <div className="management-alert management-alert--error">
          <XCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="management-alert management-alert--success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      <section className="management-staff__metrics">
        <article>
          <span className="metric-icon"><Clock3 size={18} /></span>
          <div>
            <strong>{pendingApplications.length}</strong>
            <span>Pending applications</span>
          </div>
        </article>

        <article>
          <span className="metric-icon"><Users size={18} /></span>
          <div>
            <strong>{staff.length}</strong>
            <span>Staff records</span>
          </div>
        </article>

        <article>
          <span className="metric-icon"><ShieldCheck size={18} /></span>
          <div>
            <strong>{activeStaff}</strong>
            <span>Active staff</span>
          </div>
        </article>

        <article>
          <span className="metric-icon"><LockKeyhole size={18} /></span>
          <div>
            <strong>{permissions.length}</strong>
            <span>Defined permissions</span>
          </div>
        </article>
      </section>

      <section className="management-staff__workspace">
        <nav className="management-staff__tabs" aria-label="Staff control sections">
          <button
            className={tab === 'applications' ? 'is-active' : ''}
            type="button"
            onClick={() => setTab('applications')}
          >
            Applications
            {pendingApplications.length > 0 && (
              <span>{pendingApplications.length}</span>
            )}
          </button>
          <button
            className={tab === 'staff' ? 'is-active' : ''}
            type="button"
            onClick={() => setTab('staff')}
          >
            Staff Directory
          </button>
          <button
            className={tab === 'roles' ? 'is-active' : ''}
            type="button"
            onClick={() => setTab('roles')}
          >
            Roles & Permissions
          </button>
        </nav>

        {loading ? (
          <div className="management-empty">
            <RefreshCw size={22} className="is-spinning" />
            Loading staff controls…
          </div>
        ) : tab === 'applications' ? (
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Requested role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <strong>
                        {application.first_name} {application.last_name}
                      </strong>
                      <small>{application.email}</small>
                    </td>
                    <td>{statusLabel(application.requested_role)}</td>
                    <td>{application.requested_department || '—'}</td>
                    <td>
                      <span className={`management-status management-status--${application.status}`}>
                        {statusLabel(application.status)}
                      </span>
                    </td>
                    <td>{formatDate(application.created_at)}</td>
                    <td>
                      {application.status === 'pending' ? (
                        <div className="management-actions">
                          <button
                            className="management-button management-button--approve"
                            type="button"
                            disabled={busyKey === `review-${application.id}`}
                            onClick={() => void reviewApplication(application, 'approve')}
                          >
                            <CheckCircle2 size={15} />
                            Approve
                          </button>
                          <button
                            className="management-button management-button--danger"
                            type="button"
                            disabled={busyKey === `review-${application.id}`}
                            onClick={() => setReviewId(application.id)}
                          >
                            <XCircle size={15} />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="management-muted">
                          {application.review_notes || 'Reviewed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {applications.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="management-empty">
                        No staff applications found.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === 'staff' ? (
          <div className="management-staff__directory">
            <div className="management-table-wrap">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>Staff member</th>
                    <th>Employee number</th>
                    <th>Department</th>
                    <th>Roles</th>
                    <th>Staff status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>
                          {member.first_name} {member.last_name}
                        </strong>
                        <small>{member.email}</small>
                      </td>
                      <td>{member.employee_number || '—'}</td>
                      <td>{member.department || '—'}</td>
                      <td>
                        <div className="management-role-list">
                          {member.roles.length > 0
                            ? member.roles.map((role) => (
                                <span key={role.id}>{role.roleName}</span>
                              ))
                            : <span>{statusLabel(member.role)}</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`management-status management-status--${member.staff_status || 'pending'}`}>
                          {statusLabel(member.staff_status)}
                        </span>
                      </td>
                      <td>{formatDate(member.created_at)}</td>
                    </tr>
                  ))}

                  {staff.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="management-empty">
                          No staff records found.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="management-control-grid">
              <section className="management-control-card">
                <div className="management-control-card__heading">
                  <UserCog size={19} />
                  <div>
                    <h2>Staff lifecycle</h2>
                    <p>Change the operational status of a staff member.</p>
                  </div>
                </div>

                <label>
                  Staff member
                  <select
                    value={lifecycleCustomerId}
                    onChange={(event) => setLifecycleCustomerId(event.target.value)}
                  >
                    <option value="">Select staff member</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name} — {member.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Action
                  <select
                    value={lifecycleAction}
                    onChange={(event) =>
                      setLifecycleAction(event.target.value as LifecycleAction)
                    }
                  >
                    {lifecycleActions.map((action) => (
                      <option key={action.value} value={action.value}>
                        {action.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Reason <span>(optional)</span>
                  <textarea
                    value={lifecycleReason}
                    onChange={(event) => setLifecycleReason(event.target.value)}
                    rows={3}
                    placeholder="Record the operational reason."
                  />
                </label>

                <button
                  className="management-button management-button--primary"
                  type="button"
                  disabled={busyKey === 'lifecycle'}
                  onClick={() => void applyLifecycle()}
                >
                  Apply status change
                </button>
              </section>

              <section className="management-control-card">
                <div className="management-control-card__heading">
                  <ShieldCheck size={19} />
                  <div>
                    <h2>Assign role</h2>
                    <p>Assign an approved management role to staff.</p>
                  </div>
                </div>

                <label>
                  Staff member
                  <select
                    value={roleCustomerId}
                    onChange={(event) => setRoleCustomerId(event.target.value)}
                  >
                    <option value="">Select staff member</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Role
                  <select
                    value={roleKey}
                    onChange={(event) => setRoleKey(event.target.value)}
                  >
                    {roles
                      .filter((role) => role.role_key !== 'super_manager')
                      .map((role) => (
                        <option key={role.id} value={role.role_key}>
                          {role.role_name}
                        </option>
                      ))}
                  </select>
                </label>

                <button
                  className="management-button management-button--primary"
                  type="button"
                  disabled={busyKey === 'assign-role'}
                  onClick={() => void applyRole()}
                >
                  Assign role
                </button>
              </section>
            </div>
          </div>
        ) : (
          <div className="management-staff__roles">
            <div className="management-control-grid">
              <section className="management-control-card">
                <div className="management-control-card__heading">
                  <ShieldCheck size={19} />
                  <div>
                    <h2>Role catalogue</h2>
                    <p>Current management roles and assigned staff counts.</p>
                  </div>
                </div>

                <div className="management-role-catalogue">
                  {roles.map((role) => (
                    <article key={role.id}>
                      <div>
                        <strong>{role.role_name}</strong>
                        <span>{role.role_key}</span>
                      </div>
                      <b>{role.staff_count}</b>
                    </article>
                  ))}
                </div>
              </section>

              <section className="management-control-card">
                <div className="management-control-card__heading">
                  <LockKeyhole size={19} />
                  <div>
                    <h2>Permission override</h2>
                    <p>Apply an explicit allow or deny to a staff member.</p>
                  </div>
                </div>

                <label>
                  Staff member
                  <select
                    value={permissionCustomerId}
                    onChange={(event) => setPermissionCustomerId(event.target.value)}
                  >
                    <option value="">Select staff member</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Permission
                  <select
                    value={permissionKey}
                    onChange={(event) => setPermissionKey(event.target.value)}
                  >
                    {permissions.map((permission) => (
                      <option key={permission.id} value={permission.permission_key}>
                        {permission.permission_key}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Effect
                  <select
                    value={permissionEffect}
                    onChange={(event) =>
                      setPermissionEffect(event.target.value as 'allow' | 'deny')
                    }
                  >
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </select>
                </label>

                <button
                  className="management-button management-button--primary"
                  type="button"
                  disabled={busyKey === 'assign-permission'}
                  onClick={() => void applyPermission()}
                >
                  Apply permission
                </button>
              </section>
            </div>

            <section className="management-permissions">
              <div className="management-control-card__heading">
                <LockKeyhole size={19} />
                <div>
                  <h2>Permission catalogue</h2>
                  <p>All permissions currently defined by NorthStarBank.</p>
                </div>
              </div>

              <div className="management-permission-grid">
                {permissions.map((permission) => (
                  <article key={permission.id}>
                    <strong>{permission.permission_key}</strong>
                    <span>{permission.description || permission.permission_name}</span>
                    <small>{permission.permission_group}</small>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>

      {reviewId && (
        <div className="management-modal-backdrop" role="presentation">
          <div className="management-modal" role="dialog" aria-modal="true">
            <div className="management-modal__heading">
              <div>
                <span className="management-eyebrow">Application review</span>
                <h2>Reject staff application</h2>
              </div>
              <button
                className="management-icon-button"
                type="button"
                aria-label="Close"
                onClick={() => {
                  setReviewId('')
                  setReviewNotes('')
                }}
              >
                <XCircle size={19} />
              </button>
            </div>

            <p>
              A rejection note is required and will be retained with the
              application review record.
            </p>

            <label>
              Review note
              <textarea
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                rows={5}
                autoFocus
                placeholder="Explain the reason for rejection."
              />
            </label>

            <div className="management-modal__actions">
              <button
                className="management-button management-button--secondary"
                type="button"
                onClick={() => {
                  setReviewId('')
                  setReviewNotes('')
                }}
              >
                Cancel
              </button>
              <button
                className="management-button management-button--danger"
                type="button"
                disabled={busyKey === `review-${reviewId}`}
                onClick={() => {
                  const application = applications.find(
                    (item) => item.id === reviewId,
                  )
                  if (application) {
                    void reviewApplication(application, 'reject')
                  }
                }}
              >
                Reject application
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="management-staff__notice">
        <ChevronDown size={16} />
        <span>
          Staff controls are restricted to the Super Manager authorization
          layer. Sensitive credentials and authentication secrets are never
          displayed in this workspace.
        </span>
      </div>
    </div>
  )
}
