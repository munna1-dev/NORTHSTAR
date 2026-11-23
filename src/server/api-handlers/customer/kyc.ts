import { del, get, head } from '@vercel/blob'
import { handleUpload } from '@vercel/blob/client'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../db/client.js'
import { writeAuditLog } from '../../auth/audit.js'
import { requireCustomer } from '../../auth/customer.js'

const PREFIX = 'customer-kyc/'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const DOCUMENT_TYPES = [
  'passport',
  'drivers_license',
  'national_id',
  'residence_permit',
] as const

type DocumentType = (typeof DOCUMENT_TYPES)[number]

interface UploadTokenPayload {
  customerId: string
  prefix: string
  documentType: DocumentType
}

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' &&
    DOCUMENT_TYPES.includes(value as DocumentType)
}

function isUploadCompleted(body: unknown): boolean {
  return typeof body === 'object' &&
    body !== null &&
    'type' in body &&
    (body as { type?: unknown }).type === 'blob.upload-completed'
}

function parseTokenPayload(value: string | null | undefined): UploadTokenPayload {
  if (!value) throw new Error('Missing upload authorization.')

  const payload = JSON.parse(value) as UploadTokenPayload

  if (
    typeof payload.customerId !== 'string' ||
    typeof payload.prefix !== 'string' ||
    !isDocumentType(payload.documentType)
  ) {
    throw new Error('Invalid upload authorization.')
  }

  return payload
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    if (req.method === 'POST' && isUploadCompleted(req.body)) {
      const response = await handleUpload({
        request: req,
        body: req.body,
        onBeforeGenerateToken: async () => {
          throw new Error('Invalid upload callback.')
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          const authorization = parseTokenPayload(tokenPayload)
          const expectedPrefix = `${PREFIX}${authorization.customerId}/`

          if (
            authorization.prefix !== expectedPrefix ||
            !blob.pathname.startsWith(expectedPrefix) ||
            !blob.pathname.slice(expectedPrefix.length).startsWith(`${authorization.documentType}-`)
          ) {
            await del(blob.pathname)
            throw new Error('Invalid KYC document ownership.')
          }

          const uploaded = await head(blob.pathname)

          if (
            !ALLOWED_TYPES.includes(uploaded.contentType) ||
            uploaded.size <= 0 ||
            uploaded.size > MAX_FILE_SIZE
          ) {
            await del(blob.pathname)
            throw new Error('Invalid KYC document type or size.')
          }
        },
      })

      return res.status(200).json({ ok: true, ...response })
    }

    const customer = await requireCustomer(req)

    if (!customer) {
      return res.status(401).json({ ok: false, error: 'Not authenticated.' })
    }

    if (req.method === 'POST') {
      const body = req.body as {
        action?: unknown
        pathname?: unknown
        documentType?: unknown
        originalFilename?: unknown
      }

      if (body.action === 'confirm') {
        const documentType = body.documentType as DocumentType
        const pathname = body.pathname
        const originalFilename = body.originalFilename

        const expectedPrefix = `${PREFIX}${customer.id}/`

        if (
          !isDocumentType(documentType) ||
          typeof pathname !== 'string' ||
          !pathname.startsWith(expectedPrefix) ||
          !pathname.slice(expectedPrefix.length).startsWith(`${documentType}-`) ||
          pathname.slice(expectedPrefix.length).includes('/') ||
          pathname.includes('..') ||
          typeof originalFilename !== 'string'
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid KYC upload confirmation.',
          })
        }

        const uploaded = await head(pathname)

        if (
          !ALLOWED_TYPES.includes(uploaded.contentType) ||
          uploaded.size <= 0 ||
          uploaded.size > MAX_FILE_SIZE
        ) {
          try {
            await del(pathname)
          } catch (cleanupError) {
            console.error('KYC invalid upload cleanup failed:', cleanupError)
          }

          return res.status(400).json({
            ok: false,
            error: 'Only PDF, JPEG, or PNG files up to 10 MB are accepted.',
          })
        }

        const safeFilename = originalFilename
          .split(/[\\/]/)
          .pop()!
          .split('')
          .filter((character) => {
            const code = character.charCodeAt(0)
            return code > 0x1f && code !== 0x7f
          })
          .join('')
          .slice(0, 180) || 'identity-document'

        const db = getDb()
        const client = await db.connect()

        try {
          await client.query('BEGIN')

          const profile = await client.query(
            `SELECT kyc_status
             FROM customer_profiles
             WHERE customer_id = $1
             FOR UPDATE`,
            [customer.id],
          )

          if (profile.rowCount !== 1) {
            await client.query('ROLLBACK')
            await del(pathname).catch(() => undefined)
            return res.status(409).json({
              ok: false,
              error: 'Complete your customer profile before submitting KYC.',
            })
          }

          if (profile.rows[0].kyc_status === 'verified') {
            await client.query('ROLLBACK')
            await del(pathname).catch(() => undefined)
            return res.status(409).json({
              ok: false,
              error: 'Your identity is already verified.',
            })
          }

          const existing = await client.query(
            `SELECT id
             FROM kyc_documents
             WHERE customer_id = $1
               AND document_type = $2
               AND document_status IN ('pending', 'approved')
             LIMIT 1
             FOR UPDATE`,
            [customer.id, documentType],
          )

          if (existing.rowCount) {
            await client.query('ROLLBACK')
            await del(pathname).catch(() => undefined)
            return res.status(409).json({
              ok: false,
              error: 'A document of this type is already pending or approved.',
            })
          }

          const inserted = await client.query(
            `INSERT INTO kyc_documents (
               customer_id, document_type, document_status,
               storage_provider, storage_path, original_filename,
               mime_type, file_size_bytes
             )
             VALUES ($1, $2, 'pending', 'vercel_blob', $3, $4, $5, $6)
             RETURNING id, document_type, document_status, uploaded_at`,
            [
              customer.id,
              documentType,
              pathname,
              safeFilename,
              uploaded.contentType,
              uploaded.size,
            ],
          )

          await client.query(
            `UPDATE customer_profiles
             SET kyc_status = 'pending', kyc_verified_at = NULL
             WHERE customer_id = $1`,
            [customer.id],
          )

          await client.query('COMMIT')

          try {
            await writeAuditLog(
              req,
              customer.id,
              'kyc.document_submitted',
              'kyc_document',
              inserted.rows[0].id,
              'Customer submitted an identity document.',
              {
                documentType,
                mimeType: uploaded.contentType,
                fileSizeBytes: uploaded.size,
              },
            )
          } catch (auditError) {
            console.error('KYC submission audit failed:', auditError)
          }

          return res.status(201).json({
            ok: true,
            document: inserted.rows[0],
          })
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined)
          await del(pathname).catch(() => undefined)
          throw error
        } finally {
          client.release()
        }
      }

      const response = await handleUpload({
        request: req,
        body: req.body,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          let payload: unknown

          try {
            payload = JSON.parse(clientPayload ?? '')
          } catch {
            throw new Error('Invalid KYC upload details.')
          }

          if (
            typeof payload !== 'object' ||
            payload === null ||
            !('documentType' in payload) ||
            !isDocumentType(payload.documentType)
          ) {
            throw new Error('Choose a valid identity document type.')
          }

          const documentType = payload.documentType
          const expectedPrefix = `${PREFIX}${customer.id}/`

          if (
            !pathname.startsWith(expectedPrefix) ||
            !pathname.slice(expectedPrefix.length).startsWith(`${documentType}-`) ||
            pathname.slice(expectedPrefix.length).includes('/') ||
            pathname.includes('..')
          ) {
            throw new Error('Invalid KYC document path.')
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
              documentType,
            }),
          }
        },
      })

      return res.status(200).json({ ok: true, ...response })
    }

    if (req.method === 'GET') {
      const documentId = typeof req.query.id === 'string'
        ? req.query.id
        : null

      if (documentId) {
        const db = getDb()
        const record = await db.query(
          `SELECT storage_path, mime_type
           FROM kyc_documents
           WHERE id = $1 AND customer_id = $2
           LIMIT 1`,
          [documentId, customer.id],
        )

        if (record.rowCount !== 1) {
          return res.status(404).json({
            ok: false,
            error: 'KYC document not found.',
          })
        }

        const result = await get(record.rows[0].storage_path, {
          access: 'private',
          useCache: false,
        })

        if (!result || result.statusCode !== 200) {
          return res.status(404).json({
            ok: false,
            error: 'KYC document file not found.',
          })
        }

        res.setHeader('Content-Type', record.rows[0].mime_type)
        res.setHeader('Content-Length', String(result.blob.size))
        res.setHeader('Content-Disposition', 'attachment; filename="identity-document"')
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')

        const buffer = Buffer.from(
          await new Response(result.stream).arrayBuffer(),
        )

        return res.status(200).send(buffer)
      }

      const db = getDb()
      const result = await db.query(
        `SELECT id, document_type, document_status,
                original_filename, mime_type, file_size_bytes,
                uploaded_at, reviewed_at, review_notes
         FROM kyc_documents
         WHERE customer_id = $1
         ORDER BY uploaded_at DESC`,
        [customer.id],
      )

      return res.status(200).json({
        ok: true,
        documents: result.rows,
      })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    })
  } catch (error) {
    console.error('Customer KYC request failed:', error)
    return res.status(500).json({
      ok: false,
      error: 'Unable to process your KYC request.',
    })
  }
}
