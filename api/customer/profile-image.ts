import { del, get, head } from '@vercel/blob'
import { handleUpload } from '@vercel/blob/client'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../src/server/db/client.js'
import { writeAuditLog } from '../../src/server/auth/audit.js'
import { requireCustomer } from '../../src/server/auth/customer.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PREFIX = 'customer-profile/'

interface UploadTokenPayload {
  customerId: string
  prefix: string
}

function parseTokenPayload(
  value: string | null | undefined,
): UploadTokenPayload {
  if (!value) {
    throw new Error('Missing upload authorization.')
  }

  const payload = JSON.parse(value) as UploadTokenPayload

  if (
    typeof payload.customerId !== 'string' ||
    typeof payload.prefix !== 'string'
  ) {
    throw new Error('Invalid upload authorization.')
  }

  return payload
}

function isUploadCompleted(
  body: unknown,
): body is {
  type: 'blob.upload-completed'
  payload: {
    blob: {
      pathname: string
    }
    tokenPayload?: string | null
  }
} {
  return (
    typeof body === 'object' &&
    body !== null &&
    'type' in body &&
    (body as { type?: unknown }).type === 'blob.upload-completed'
  )
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    if (req.method === 'POST') {
      /*
       * Vercel Blob sends the upload-completed callback independently
       * of the customer's browser session. Authentication for that
       * callback comes from the signed Blob callback plus our
       * server-generated tokenPayload.
       */
      if (isUploadCompleted(req.body)) {
        const response = await handleUpload({
          request: req,
          body: req.body,
          onBeforeGenerateToken: async () => {
            throw new Error('Token generation is not valid for this event.')
          },
          onUploadCompleted: async ({ blob, tokenPayload }) => {
            const authorization = parseTokenPayload(tokenPayload)
            const expectedPrefix = `${PREFIX}${authorization.customerId}/`

            if (
              authorization.prefix !== expectedPrefix ||
              !blob.pathname.startsWith(expectedPrefix)
            ) {
              await del(blob.pathname)
              throw new Error('Invalid profile image ownership.')
            }

            const uploaded = await head(blob.pathname)

            if (
              !ALLOWED_TYPES.includes(uploaded.contentType) ||
              uploaded.size > MAX_FILE_SIZE
            ) {
              await del(blob.pathname)
              throw new Error('Invalid profile image.')
            }

            const db = getDb()

            const existing = await db.query(
              `
                SELECT profile_image_path
                FROM customers
                WHERE id = $1
                  AND status = 'active'
                LIMIT 1
              `,
              [authorization.customerId],
            )

            if (existing.rowCount !== 1) {
              await del(blob.pathname)
              throw new Error('Customer account not found.')
            }

            const oldPath = existing.rows[0].profile_image_path as
              | string
              | null

            const result = await db.query(
              `
                UPDATE customers
                SET profile_image_path = $1,
                    profile_image_url = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                  AND status = 'active'
              `,
              [blob.pathname, authorization.customerId],
            )

            if (result.rowCount !== 1) {
              await del(blob.pathname)
              throw new Error('Unable to save profile image.')
            }

            if (oldPath && oldPath !== blob.pathname) {
              try {
                await del(oldPath)
              } catch (cleanupError) {
                console.error(
                  'Unable to remove previous profile image:',
                  cleanupError,
                )
              }
            }
          },
        })

        return res.status(200).json({
          ok: true,
          ...response,
        })
      }

      /*
       * Normal browser request: require the authenticated customer
       * before issuing a client upload token.
       */
      const customer = await requireCustomer(req)

      if (!customer) {
        return res.status(401).json({
          ok: false,
          error: 'Not authenticated.',
        })
      }

      const response = await handleUpload({
        request: req,
        body: req.body,
        onBeforeGenerateToken: async (pathname) => {
          const expectedPrefix = `${PREFIX}${customer.id}/`

          if (!pathname.startsWith(expectedPrefix)) {
            throw new Error('Invalid profile image path.')
          }

          return {
            allowedContentTypes: ALLOWED_TYPES,
            maximumSizeInBytes: MAX_FILE_SIZE,
            addRandomSuffix: true,
            allowOverwrite: false,
            validUntil: Date.now() + 10 * 60 * 1000,
            tokenPayload: JSON.stringify({
              customerId: customer.id,
              prefix: expectedPrefix,
            }),
          }
        },
      })

      return res.status(200).json({
        ok: true,
        ...response,
      })
    }

    const customer = await requireCustomer(req)

    if (!customer) {
      return res.status(401).json({
        ok: false,
        error: 'Not authenticated.',
      })
    }

    if (req.method === 'GET') {
      if (!customer.profile_image_path) {
        return res.status(404).json({
          ok: false,
          error: 'No profile image.',
        })
      }

      const result = await get(customer.profile_image_path, {
        access: 'private',
        useCache: false,
      })

      if (!result || result.statusCode !== 200) {
        return res.status(404).json({
          ok: false,
          error: 'Image not found.',
        })
      }

      res.setHeader('Content-Type', result.blob.contentType)
      res.setHeader('Content-Length', String(result.blob.size))
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')

      const buffer = Buffer.from(
        await new Response(result.stream).arrayBuffer(),
      )

      return res.status(200).send(buffer)
    }

    if (req.method === 'DELETE') {
      const oldPath = customer.profile_image_path

      if (!oldPath) {
        return res.status(200).json({ ok: true })
      }

      try {
        await del(oldPath)
      } catch (deleteError) {
        console.error('Unable to remove profile image blob:', deleteError)
      }

      const db = getDb()

      await db.query(
        `
          UPDATE customers
          SET profile_image_path = NULL,
              profile_image_url = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [customer.id],
      )

      await writeAuditLog(
        req,
        customer.id,
        'customer.profile_image_removed',
        'customer',
        customer.id,
        'Customer profile image removed.',
      )

      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    })
  } catch (error) {
    console.error('Customer profile image operation failed:', error)

    return res.status(500).json({
      ok: false,
      error: 'Unable to process profile image.',
    })
  }
}
