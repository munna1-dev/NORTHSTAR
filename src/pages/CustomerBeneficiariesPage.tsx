import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  Edit3,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  createCustomerBeneficiary,
  disableCustomerBeneficiary,
  getCustomerBeneficiaries,
  updateCustomerBeneficiary,
} from "../lib/customerApi"
import type { Beneficiary } from "../types"
import "./CustomerBeneficiariesPage.css"

type StatusFilter = "all" | "active" | "disabled"

interface BeneficiaryForm {
  name: string
  institution: string
  accountNumber: string
}

const emptyForm: BeneficiaryForm = {
  name: "",
  institution: "",
  accountNumber: "",
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function beneficiaryIcon(beneficiary: Beneficiary) {
  return beneficiary.institution.trim() ? (
    <Building2 size={21} />
  ) : (
    <UserRound size={21} />
  )
}

export function CustomerBeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBeneficiary, setEditingBeneficiary] =
    useState<Beneficiary | null>(null)
  const [removeTarget, setRemoveTarget] =
    useState<Beneficiary | null>(null)
  const [form, setForm] = useState<BeneficiaryForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const result = await getCustomerBeneficiaries()

        if (!cancelled) {
          setBeneficiaries(result)
          setError("")
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your saved recipients.",
          )
        }
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

  const filteredBeneficiaries = useMemo(() => {
    const query = search.trim().toLowerCase()

    return beneficiaries.filter((beneficiary) => {
      const matchesStatus =
        statusFilter === "all" ||
        beneficiary.status === statusFilter

      if (!matchesStatus) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        beneficiary.name,
        beneficiary.institution,
        beneficiary.maskedAccountNumber,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [beneficiaries, search, statusFilter])

  const activeCount = beneficiaries.filter(
    (beneficiary) => beneficiary.status === "active",
  ).length

  const disabledCount = beneficiaries.filter(
    (beneficiary) => beneficiary.status === "disabled",
  ).length

  function openCreateModal() {
    setEditingBeneficiary(null)
    setForm(emptyForm)
    setError("")
    setModalOpen(true)
  }

  function openEditModal(beneficiary: Beneficiary) {
    setEditingBeneficiary(beneficiary)
    setForm({
      name: beneficiary.name,
      institution: beneficiary.institution,
      accountNumber: "",
    })
    setError("")
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
    setEditingBeneficiary(null)
    setForm(emptyForm)
  }

  function closeRemoveDialog() {
    if (actionId) {
      return
    }

    setRemoveTarget(null)
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError("Recipient name is required.")
      return
    }

    if (!editingBeneficiary && !form.accountNumber.trim()) {
      setError("Account identifier is required.")
      return
    }

    setSaving(true)
    setError("")

    try {
      if (editingBeneficiary) {
        const updated = await updateCustomerBeneficiary(
          editingBeneficiary.id,
          {
            name: form.name.trim(),
            institution: form.institution.trim(),
            ...(form.accountNumber.trim()
              ? {
                  accountNumber: form.accountNumber.trim(),
                }
              : {}),
          },
        )

        setBeneficiaries((current) =>
          current.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        )
      } else {
        const created = await createCustomerBeneficiary({
          name: form.name.trim(),
          accountNumber: form.accountNumber.trim(),
          institution: form.institution.trim(),
        })

        setBeneficiaries((current) => [created, ...current])
      }

      setModalOpen(false)
      setEditingBeneficiary(null)
      setForm(emptyForm)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save this recipient.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(beneficiary: Beneficiary) {
    setActionId(beneficiary.id)
    setError("")

    try {
      const updated = await updateCustomerBeneficiary(
        beneficiary.id,
        {
          status:
            beneficiary.status === "active"
              ? "disabled"
              : "active",
        },
      )

      setBeneficiaries((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update this recipient.",
      )
    } finally {
      setActionId(null)
    }
  }

  async function handleRemove() {
    if (!removeTarget) {
      return
    }

    setActionId(removeTarget.id)
    setError("")

    try {
      await disableCustomerBeneficiary(removeTarget.id)

      setBeneficiaries((current) =>
        current.map((item) =>
          item.id === removeTarget.id
            ? {
                ...item,
                status: "disabled",
              }
            : item,
        ),
      )

      setRemoveTarget(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove this recipient.",
      )
    } finally {
      setActionId(null)
    }
  }

  return (
    <main className="beneficiaries-page">
      <div className="beneficiaries-container">
        <div className="beneficiaries-breadcrumb">
          <Link to="/customer">
            <ArrowLeft size={17} />
            Back to dashboard
          </Link>
        </div>

        <header className="beneficiaries-header">
          <div>
            <span className="beneficiaries-eyebrow">
              Recipients
            </span>
            <h1>Saved beneficiaries</h1>
            <p>
              Manage the recipients you use for account transfers.
            </p>
          </div>

          <button
            className="beneficiary-primary-button"
            type="button"
            onClick={openCreateModal}
          >
            <Plus size={18} />
            Add beneficiary
          </button>
        </header>

        <section className="beneficiary-security-notice">
          <div className="beneficiary-security-icon">
            <ShieldCheck size={22} />
          </div>

          <div>
            <strong>Your recipient information is protected.</strong>
            <p>
              Beneficiary details are managed through your
              authenticated session. Account identifiers are masked
              in the customer portal and changes are recorded in the
              security audit trail.
            </p>
          </div>
        </section>

        {error && (
          <div className="beneficiary-alert" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <section className="beneficiary-toolbar">
          <div className="beneficiary-search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search recipients"
              aria-label="Search recipients"
            />
          </div>

          <div className="beneficiary-filters">
            <button
              type="button"
              className={
                statusFilter === "all"
                  ? "active"
                  : ""
              }
              onClick={() => setStatusFilter("all")}
            >
              All
              <span>{beneficiaries.length}</span>
            </button>

            <button
              type="button"
              className={
                statusFilter === "active"
                  ? "active"
                  : ""
              }
              onClick={() => setStatusFilter("active")}
            >
              Active
              <span>{activeCount}</span>
            </button>

            <button
              type="button"
              className={
                statusFilter === "disabled"
                  ? "active"
                  : ""
              }
              onClick={() => setStatusFilter("disabled")}
            >
              Disabled
              <span>{disabledCount}</span>
            </button>
          </div>
        </section>

        {loading ? (
          <section className="beneficiary-empty-state">
            <div className="beneficiary-loading-spinner" />
            <h2>Loading saved recipients</h2>
            <p>Please wait while your beneficiaries are retrieved.</p>
          </section>
        ) : filteredBeneficiaries.length === 0 ? (
          <section className="beneficiary-empty-state">
            <div className="beneficiary-empty-icon">
              <UserRound size={25} />
            </div>

            <h2>
              {beneficiaries.length === 0
                ? "No beneficiaries yet"
                : "No matching beneficiaries"}
            </h2>

            <p>
              {beneficiaries.length === 0
                ? "Add a recipient to make future transfers easier."
                : "Try a different search or status filter."}
            </p>

            {beneficiaries.length === 0 && (
              <button
                className="beneficiary-primary-button"
                type="button"
                onClick={openCreateModal}
              >
                <Plus size={18} />
                Add beneficiary
              </button>
            )}
          </section>
        ) : (
          <section className="beneficiary-list">
            {filteredBeneficiaries.map((beneficiary) => {
              const busy = actionId === beneficiary.id

              return (
                <article
                  className="beneficiary-card"
                  key={beneficiary.id}
                >
                  <div className="beneficiary-card-icon">
                    {beneficiaryIcon(beneficiary)}
                  </div>

                  <div className="beneficiary-card-content">
                    <div className="beneficiary-card-heading">
                      <div>
                        <h2>{beneficiary.name}</h2>

                        {beneficiary.institution && (
                          <p>{beneficiary.institution}</p>
                        )}
                      </div>

                      <span
                        className={`beneficiary-status beneficiary-status-${beneficiary.status}`}
                      >
                        {beneficiary.status === "active"
                          ? "Active"
                          : "Disabled"}
                      </span>
                    </div>

                    <div className="beneficiary-card-details">
                      <div>
                        <span>Account</span>
                        <strong>
                          {beneficiary.maskedAccountNumber}
                        </strong>
                      </div>

                      <div>
                        <span>Added</span>
                        <strong>
                          {formatDate(beneficiary.createdAt)}
                        </strong>
                      </div>

                      <div>
                        <span>Updated</span>
                        <strong>
                          {formatDate(beneficiary.updatedAt)}
                        </strong>
                      </div>
                    </div>

                    <div className="beneficiary-card-actions">
                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(beneficiary)
                        }
                        disabled={busy}
                      >
                        <Edit3 size={16} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleToggleStatus(beneficiary)
                        }
                        disabled={busy}
                      >
                        {beneficiary.status === "active" ? (
                          <>
                            <X size={16} />
                            {busy
                              ? "Updating..."
                              : "Disable"}
                          </>
                        ) : (
                          <>
                            <Check size={16} />
                            {busy
                              ? "Updating..."
                              : "Enable"}
                          </>
                        )}
                      </button>

                      {beneficiary.status === "active" && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            setRemoveTarget(beneficiary)
                          }
                          disabled={busy}
                        >
                          <Trash2 size={16} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}

        <footer className="beneficiary-page-footer">
          <ShieldCheck size={17} />
          <span>
            Never share your online banking password, one-time
            security codes, or complete account credentials with
            anyone.
          </span>
        </footer>
      </div>

      {modalOpen && (
        <div
          className="beneficiary-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal()
            }
          }}
        >
          <section
            className="beneficiary-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beneficiary-modal-title"
          >
            <div className="beneficiary-modal-header">
              <div>
                <span className="beneficiaries-eyebrow">
                  {editingBeneficiary
                    ? "Update recipient"
                    : "New recipient"}
                </span>

                <h2 id="beneficiary-modal-title">
                  {editingBeneficiary
                    ? "Edit beneficiary"
                    : "Add beneficiary"}
                </h2>
              </div>

              <button
                type="button"
                className="beneficiary-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="beneficiary-form"
              onSubmit={(event) => void handleSubmit(event)}
            >
              {error && (
                <div className="beneficiary-alert" role="alert">
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <label>
                <span>Recipient name</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Jane Smith"
                  autoComplete="name"
                  disabled={saving}
                  required
                />
              </label>

              <label>
                <span>Institution</span>
                <input
                  value={form.institution}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      institution: event.target.value,
                    }))
                  }
                  placeholder="Bank or financial institution"
                  disabled={saving}
                />
              </label>

              <label className="beneficiary-account-field">
                <span>
                  Account identifier{" "}
                  {editingBeneficiary && "(optional)"}
                </span>

                <input
                  value={form.accountNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      accountNumber: event.target.value,
                    }))
                  }
                  placeholder={
                    editingBeneficiary
                      ? "Leave blank to keep current identifier"
                      : "Enter account identifier"
                  }
                  autoComplete="off"
                  disabled={saving}
                  required={!editingBeneficiary}
                />

                {editingBeneficiary && (
                  <small>
                    The current identifier is masked in the portal.
                    Leave this field blank unless it needs to be
                    changed.
                  </small>
                )}
              </label>

              <div className="beneficiary-form-actions">
                <button
                  type="button"
                  className="beneficiary-secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="beneficiary-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Check size={17} />
                      {editingBeneficiary
                        ? "Save changes"
                        : "Add beneficiary"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {removeTarget && (
        <div
          className="beneficiary-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRemoveDialog()
            }
          }}
        >
          <section
            className="beneficiary-modal beneficiary-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-beneficiary-title"
          >
            <div className="beneficiary-confirm-icon">
              <Trash2 size={24} />
            </div>

            <h2 id="remove-beneficiary-title">
              Remove beneficiary?
            </h2>

            <p>
              <strong>{removeTarget.name}</strong> will be removed
              from your active recipients. The record is retained
              securely as disabled for audit purposes.
            </p>

            <div className="beneficiary-form-actions">
              <button
                type="button"
                className="beneficiary-secondary-button"
                onClick={closeRemoveDialog}
                disabled={Boolean(actionId)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="beneficiary-danger-button"
                onClick={() => void handleRemove()}
                disabled={Boolean(actionId)}
              >
                <Trash2 size={17} />
                {actionId === removeTarget.id
                  ? "Removing..."
                  : "Remove"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
