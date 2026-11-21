import { createHash, randomBytes } from 'node:crypto'

export function createStaffInvitationToken() {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')

  return { token, tokenHash }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendStaffInvitationEmail(input: {
  to: string
  firstName: string
  staffEmail: string
  token: string
}) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error('Email delivery is not configured.')
  }

  // Staff onboarding must always stay on the account portal.
  // Do not use APP_ORIGIN here because it may point to the mail service.
  const origin = new URL('https://account.northstarbank.site')

  const setupUrl = new URL('/staff/setup', origin)
  setupUrl.searchParams.set('token', input.token)

  const firstName = escapeHtml(input.firstName)
  const staffEmail = escapeHtml(input.staffEmail)
  const link = escapeHtml(setupUrl.toString())

  const from =
    process.env.RESEND_FROM_EMAIL ||
    'NorthStarBank <no-reply@northstarbank.site>'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      tracking: { click: false },
      to: [input.to],
      subject: 'Complete your NorthStarBank staff registration',
      text: [
        `Hello ${input.firstName},`,
        '',
        'Your NorthStarBank staff application has been approved.',
        `Your official staff email is ${input.staffEmail}.`,
        '',
        'Create your password using this secure, single-use link:',
        setupUrl.toString(),
        '',
        'This invitation expires in 24 hours.',
        'If you did not apply for staff access, please ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102a43">
          <h2>NorthStarBank staff registration</h2>
          <p>Hello ${firstName},</p>
          <p>Your staff application has been approved.</p>
          <p>Your official staff email address is:</p>
          <p><strong>${staffEmail}</strong></p>
          <p>Use the secure button below to create your password.</p>
          <p>
            <a href="${link}" style="display:inline-block;padding:13px 22px;background:#102a43;color:#fff;text-decoration:none;border-radius:6px">
              Create staff password
            </a>
          </p>
          <p>This single-use invitation expires in 24 hours.</p>
          <p>If you did not apply for staff access, ignore this email.</p>
          <p>NorthStarBank</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    // Do not expose provider responses or credentials to the browser.
    throw new Error('The invitation email could not be delivered.')
  }
}
