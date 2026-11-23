import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../db/client.js'
import {
  customerResponse,
  requireCustomer,
} from '../../auth/customer.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    })
  }

  try {
    const customer = await requireCustomer(req)

    if (!customer) {
      return res.status(401).json({
        ok: false,
        authenticated: false,
        error: 'Not authenticated.',
      })
    }

    const db = getDb()

    const result = await db.query(
      `
        SELECT
          c.username,
          c.created_at,
          c.profile_image_path,
          p.date_of_birth,
          p.address_line1,
          p.address_line2,
          p.city,
          p.state_code,
          p.postal_code,
          p.country_code,
          p.kyc_status,
          p.kyc_verified_at
        FROM customers c
        LEFT JOIN customer_profiles p
          ON p.customer_id = c.id
        WHERE c.id = $1
        LIMIT 1
      `,
      [customer.id],
    )

    if (result.rowCount !== 1) {
      return res.status(404).json({
        ok: false,
        error: 'Customer profile not found.',
      })
    }

    const profile = result.rows[0]

    return res.status(200).json({
      ok: true,
      customer: {
        ...customerResponse(customer),
        profileImageUrl: profile.profile_image_path
          ? '/api/customer/profile-image'
          : null,
        username: profile.username,
        dateOfBirth: profile.date_of_birth
          ? String(profile.date_of_birth).slice(0, 10)
          : null,
        addressLine1: profile.address_line1 ?? null,
        addressLine2: profile.address_line2 ?? null,
        city: profile.city ?? null,
        stateCode: profile.state_code ?? null,
        postalCode: profile.postal_code ?? null,
        countryCode: profile.country_code ?? null,
        kycStatus: profile.kyc_status ?? null,
        kycVerifiedAt: profile.kyc_verified_at ?? null,
        createdAt: profile.created_at,
      },
    })
  } catch (error) {
    console.error('Customer profile lookup failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to load customer profile.',
    })
  }
}
