import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'
import * as OTPAuth from 'otpauth'

function encryptionKey(): Buffer {
  const value = process.env.STAFF_MFA_ENCRYPTION_KEY

  if (!value) {
    throw new Error('STAFF_MFA_ENCRYPTION_KEY is not configured.')
  }

  const key = Buffer.from(value, 'base64')

  if (key.length !== 32) {
    throw new Error('STAFF_MFA_ENCRYPTION_KEY must encode 32 bytes.')
  }

  return key
}

export function encryptStaffMfaSecret(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptStaffMfaSecret(value: string): string {
  const [version, ivText, tagText, encryptedText] = value.split(':')

  if (
    version !== 'v1' ||
    !ivText ||
    !tagText ||
    !encryptedText
  ) {
    throw new Error('Invalid encrypted MFA secret format.')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivText, 'base64'),
  )

  decipher.setAuthTag(Buffer.from(tagText, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function createStaffMfaEnrollment(email: string) {
  const secret = new OTPAuth.Secret({ size: 20 })

  const totp = new OTPAuth.TOTP({
    issuer: 'NorthStarBank',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })

  return {
    secret: secret.base32,
    otpauthUrl: totp.toString(),
  }
}

export function verifyStaffMfaCode(
  secretBase32: string,
  code: string,
): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'NorthStarBank',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })

  return totp.validate({ token: code, window: 1 }) !== null
}
