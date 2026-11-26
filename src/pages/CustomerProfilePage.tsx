import {
  Camera,
  CheckCircle2,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  getCustomerProfile,
  removeCustomerProfileImage,
  uploadCustomerProfileImage,
  uploadCustomerKycDocument,
  type CustomerKycDocumentType,
} from "../lib/customerApi"
import { signOutCustomer } from "../lib/session"
import type { UserProfile } from "../types"
import "./CustomerProfilePage.css"

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_PROFILE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
]

export function CustomerProfilePage() {
  const [customer, setCustomer] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageMessage, setImageMessage] = useState("")
  const [imageError, setImageError] = useState("")
  const [imageVersion, setImageVersion] = useState(0)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [kycDocumentType, setKycDocumentType] =
    useState<CustomerKycDocumentType>("national_id")
  const [kycBusy, setKycBusy] = useState(false)
  const [kycMessage, setKycMessage] = useState("")
  const [kycError, setKycError] = useState("")
  const kycFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      try {
        const result = await getCustomerProfile()

        if (!mounted) {
          return
        }

        setCustomer(result)
      } catch (loadError) {
        if (!mounted) {
          return
        }

        setImageError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your profile.",
        )
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [])

  async function handleProfileImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    event.target.value = ""

    if (!file || !customer) {
      return
    }

    setImageError("")
    setImageMessage("")

    if (!ALLOWED_PROFILE_IMAGE_TYPES.includes(file.type)) {
      setImageError("Choose a JPEG, PNG, or WebP image.")
      return
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setImageError("Profile images must be 5 MB or smaller.")
      return
    }

    setImageBusy(true)

    try {
      const updatedCustomer = await uploadCustomerProfileImage(
        customer.id,
        file,
      )

      setCustomer(updatedCustomer)
      setImageLoadFailed(false)
      setImageVersion((version) => version + 1)
      setImageMessage("Profile picture updated successfully.")
    } catch (uploadError) {
      setImageError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to update your profile picture.",
      )
    } finally {
      setImageBusy(false)
    }
  }


  async function handleKycDocumentChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file || !customer || kycBusy) return

    setKycError("")
    setKycMessage("")

    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setKycError("Choose a PDF, JPEG, or PNG document.")
      return
    }

    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setKycError("Identity documents must be 10 MB or smaller.")
      return
    }

    setKycBusy(true)

    try {
      await uploadCustomerKycDocument(
        customer.id,
        kycDocumentType,
        file,
      )

      setKycMessage("Your identity document was submitted successfully.")

      // Refresh profile separately; a refresh failure must not hide
      // the successful document submission confirmation.
      try {
        setCustomer(await getCustomerProfile())
      } catch {
        // The document submission itself was already confirmed.
      }
    } catch (uploadError) {
      setKycError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to submit your identity document.",
      )
    } finally {
      setKycBusy(false)
    }
  }

  async function handleRemoveProfileImage() {
    if (!customer?.profileImageUrl || imageBusy) return

    if (!window.confirm("Remove your profile picture?")) return

    setImageError("")
    setImageMessage("")
    setImageBusy(true)

    try {
      await removeCustomerProfileImage()

      setCustomer({
        ...customer,
        profileImageUrl: null,
      })

      setImageLoadFailed(false)
      setImageVersion((version) => version + 1)

      window.dispatchEvent(
        new CustomEvent("northstar:customer-profile-image-updated", {
          detail: {
            profileImageUrl: null,
            profileImageVersion: Date.now(),
          },
        }),
      )

      setImageMessage("Profile picture removed.")
    } catch (removeError) {
      setImageError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove your profile picture.",
      )
    } finally {
      setImageBusy(false)
    }
  }


  async function handleSignOut() {
    await signOutCustomer()
    window.location.assign("/")
  }

  if (loading) {
    return (
      <section className="customer-profile">
        <div className="customer-profile__loading">
          <p>Loading your profile…</p>
        </div>
      </section>
    )
  }

  if (!customer) {
    return (
      <section className="customer-profile">
        <div className="customer-profile__error" role="alert">
          <strong>Unable to load your profile</strong>
          <p>
            {imageError || "Your customer profile is unavailable."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  const initials =
    `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase()

  const profileImageSrc = customer.profileImageUrl
    ? `${customer.profileImageUrl}?v=${imageVersion}`
    : null

  return (
    <section className="customer-profile">
      <header className="customer-profile__hero">
        <div>
          <span className="customer-profile__eyebrow">
            CUSTOMER BANKING
          </span>
          <h1>Profile</h1>
          <p>
            Review and manage the personal information associated with
            your NorthStarBank customer profile.
          </p>
        </div>
      </header>

      <div className="customer-profile__grid">
        <section className="customer-profile__card customer-profile__identity">
          <div className="customer-profile__identity-main">
            <div className="customer-profile__avatar-wrap">
              <div className="customer-profile__avatar">
                {profileImageSrc && !imageLoadFailed ? (
                  <img
                    src={profileImageSrc}
                    alt={`${customer.firstName} ${customer.lastName}`}
                    onError={() => setImageLoadFailed(true)}
                  />
                ) : (
                  initials
                )}
              </div>

              <button
                className="customer-profile__avatar-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageBusy}
                aria-label="Change profile picture"
                title="Change profile picture"
              >
                <Camera size={15} />
              </button>

              {customer.profileImageUrl ? (
                <button
                  className="customer-profile__avatar-remove-button"
                  type="button"
                  onClick={handleRemoveProfileImage}
                  disabled={imageBusy}
                  aria-label="Remove profile picture"
                  title="Remove profile picture"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}

              <input
                ref={fileInputRef}
                className="customer-profile__file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProfileImageChange}
                disabled={imageBusy}
              />
            </div>

            <div className="customer-profile__identity-copy">
              <span>Customer</span>
              <h2>
                {customer.firstName} {customer.lastName}
              </h2>
              <p>Customer #{customer.customerNumber}</p>
            </div>
          </div>

          <span
            className={`customer-profile__status customer-profile__status--${customer.status}`}
          >
            {customer.status}
          </span>

          {imageBusy ? (
            <p className="customer-profile__muted-copy" role="status">
              Updating profile picture…
            </p>
          ) : null}

          {imageMessage ? (
            <div className="customer-profile__image-message" role="status">
              <CheckCircle2 size={16} />
              <span>{imageMessage}</span>
            </div>
          ) : null}

          {imageError ? (
            <div className="customer-profile__image-error" role="alert">
              {imageError}
            </div>
          ) : null}
        </section>

        <section className="customer-profile__card">
          <div className="customer-profile__section-heading">
            <UserRound size={19} />
            <div>
              <span>PERSONAL INFORMATION</span>
              <h2>Contact details</h2>
            </div>
          </div>

          <div className="customer-profile__details">
            <div>
              <span>Full name</span>
              <strong>
                {customer.firstName} {customer.lastName}
              </strong>
            </div>

            <div>
              <span>Email address</span>
              <strong>
                <Mail size={16} />
                {customer.email}
              </strong>
            </div>

            <div>
              <span>Phone number</span>
              <strong>
                <Phone size={16} />
                {customer.phone || "Not provided"}
              </strong>
            </div>

            <div>
              <span>Customer number</span>
              <strong>{customer.customerNumber}</strong>
            </div>

            <div>
              <span>Username</span>
              <strong>{customer.username || "Not available"}</strong>
            </div>

            <div>
              <span>Date of birth</span>
              <strong>{customer.dateOfBirth || "Not provided"}</strong>
            </div>

            <div>
              <span>Account created</span>
              <strong>
                {customer.createdAt
                  ? new Date(customer.createdAt).toLocaleDateString()
                  : "Not available"}
              </strong>
            </div>

            <div>
              <span>Account status</span>
              <strong>{customer.status}</strong>
            </div>

            <div>
              <span>Customer role</span>
              <strong>{customer.role}</strong>
            </div>
          </div>
        </section>

        <section className="customer-profile__card">
          <div className="customer-profile__section-heading">
            <UserRound size={19} />
            <div>
              <span>RESIDENTIAL INFORMATION</span>
              <h2>Registered address</h2>
            </div>
          </div>

          <div className="customer-profile__details">
            <div>
              <span>Address</span>
              <strong>{customer.addressLine1 || "Not provided"}</strong>
            </div>
            <div>
              <span>Apartment / unit</span>
              <strong>{customer.addressLine2 || "Not provided"}</strong>
            </div>
            <div>
              <span>City</span>
              <strong>{customer.city || "Not provided"}</strong>
            </div>
            <div>
              <span>State / region</span>
              <strong>{customer.stateCode || "Not provided"}</strong>
            </div>
            <div>
              <span>Postal code</span>
              <strong>{customer.postalCode || "Not provided"}</strong>
            </div>
            <div>
              <span>Country code</span>
              <strong>{customer.countryCode || "Not provided"}</strong>
            </div>
          </div>
        </section>

        <section className="customer-profile__card">
          <div className="customer-profile__section-heading">
            <ShieldCheck size={19} />
            <div>
              <span>IDENTITY VERIFICATION</span>
              <h2>Know Your Customer (KYC)</h2>
            </div>
          </div>

          <div className="customer-profile__kyc">
            <span
              className={`customer-profile__kyc-status customer-profile__kyc-status--${customer.kycStatus || "unavailable"}`}
            >
              {customer.kycStatus
                ? customer.kycStatus.replace("_", " ")
                : "Not available"}
            </span>
            <p>
              {customer.kycStatus === "verified"
                ? "Your identity verification has been marked as verified."
                : customer.kycStatus === "rejected"
                  ? "Your identity verification was not approved. Please contact NorthStarBank support for assistance."
                  : customer.kycStatus === "pending"
                    ? "Your identity verification is pending review."
                    : "Verification information is currently unavailable."}
            </p>
            {customer.kycVerifiedAt ? (
              <p>
                Verified on {new Date(customer.kycVerifiedAt).toLocaleDateString()}
              </p>
            ) : null}

            {customer.kycStatus !== "verified" ? (
              <div className="customer-profile__kyc-upload">
                <label htmlFor="customer-kyc-document-type">
                  Identity document type
                </label>
                <select
                  id="customer-kyc-document-type"
                  value={kycDocumentType}
                  onChange={(event) =>
                    setKycDocumentType(
                      event.target.value as CustomerKycDocumentType,
                    )
                  }
                  disabled={kycBusy}
                >
                  <option value="national_id">National ID</option>
                  <option value="passport">International passport</option>
                  <option value="drivers_license">Driver's licence</option>
                  <option value="residence_permit">Residence permit</option>
                </select>

                <input
                  ref={kycFileInputRef}
                  className="customer-profile__kyc-file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={handleKycDocumentChange}
                  disabled={kycBusy}
                  aria-label="Choose identity document"
                />

                <button
                  className="customer-profile__kyc-upload-button"
                  type="button"
                  onClick={() => kycFileInputRef.current?.click()}
                  disabled={kycBusy}
                >
                  {kycBusy ? "Uploading document…" : "Choose document and submit"}
                </button>

                <p className="customer-profile__kyc-help">
                  Accepted formats: PDF, JPEG, and PNG. Maximum file size: 10 MB.
                  Your document is submitted privately for review.
                </p>

                {kycMessage ? (
                  <p className="customer-profile__kyc-success" role="status">
                    {kycMessage}
                  </p>
                ) : null}

                {kycError ? (
                  <p className="customer-profile__kyc-error" role="alert">
                    {kycError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="customer-profile__card">
          <div className="customer-profile__section-heading">
            <ShieldCheck size={19} />
            <div>
              <span>ACCOUNT SECURITY</span>
              <h2>Security settings</h2>
            </div>
          </div>

          <div className="customer-profile__security">
            <div>
              <strong>Secure authentication</strong>
              <p>
                Your customer session is protected by an HttpOnly
                secure session cookie.
              </p>
            </div>

            <Link to="/customer/security">
              Review security
            </Link>
          </div>

          <div className="customer-profile__security">
            <div>
              <strong>Password and multi-factor authentication</strong>
              <p>
                Manage your password and available security controls
                from the dedicated security page.
              </p>
            </div>

            <Link to="/customer/security">
              Security controls
            </Link>
          </div>
        </section>

        <section className="customer-profile__card">
          <div className="customer-profile__section-heading">
            <ShieldCheck size={19} />
            <div>
              <span>SESSION</span>
              <h2>Account access</h2>
            </div>
          </div>

          <p className="customer-profile__session-copy">
            You are signed in to the NorthStarBank customer portal.
            Sign out when you are finished using a shared or public
            device.
          </p>

          <button
            className="customer-profile__signout"
            type="button"
            onClick={() => void handleSignOut()}
          >
            Sign out securely
          </button>
        </section>
      </div>
    </section>
  )
}
