import { get } from '@vercel/blob'
import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requirePermission } from '../../auth/management.js'
import { getDb } from '../../db/client.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VALID_STATUSES = new Set(['pending', 'approved', 'rejected'])

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    if (!['GET', 'PATCH'].includes(req.method ?? '')) {
      res.setHeader('Allow', 'GET, PATCH')
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed.',
      })
    }

    const isDecision = req.method === 'PATCH'
    const user = await requirePermission(
      req,
      isDecision ? 'kyc.review' : 'kyc.view',
    )

    if (!user) {
      return res.status(403).json({
        ok: false,
        error: 'You do not have permission to access KYC records.',
      })
    }

    const db = getDb()

    if (req.method === 'GET') {
      const documentId = typeof req.query.id === 'string'
        ? req.query.id.trim()
        : ''

      // Private file retrieval. Never return the storage path or public URL.
      if (documentId) {
        if (!UUID_PATTERN.test(documentId)) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid document ID.',
          })
        }

        const record = await db.query(
          `SELECT storage_path, mime_type
           FROM kyc_documents
           WHERE id = $1
             AND storage_provider = 'vercel_blob'
           LIMIT 1`,
          [documentId],
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
            error: 'Private KYC document file not found.',
          })
        }

        const allowedTypes = new Set([
          'application/pdf',
          'image/jpeg',
          'image/png',
        ])
        const mimeType = record.rows[0].mime_type

        if (!allowedTypes.has(mimeType)) {
          return res.status(415).json({
            ok: false,
            error: 'Unsupported document format.',
          })
        }

        const buffer = Buffer.from(
          await new Response(result.stream).arrayBuffer(),
        )

        res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Length', String(buffer.length))
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="kyc-document"',
        )
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Content-Security-Policy', "default-src 'none'")

        return res.status(200).send(buffer)
      }

      const requestedStatus = typeof req.query.status === 'string'
        ? req.query.status.trim()
        : ''

      if (requestedStatus && !VALID_STATUSES.has(requestedStatus)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid KYC document status.',
        })
      }

      const search = typeof req.query.search === 'string'
        ? req.query.search.trim().slice(0, 100)
        : ''

      const values: unknown[] = []
      const conditions: string[] = []

      if (requestedStatus) {
        values.push(requestedStatus)
        conditions.push(`kd.document_status = $${values.length}`)
      }

      if (search) {
        values.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`)
        const index = values.length
        conditions.push(`(
          c.customer_number ILIKE $${index} ESCAPE '\\'
          OR c.first_name ILIKE $${index} ESCAPE '\\'
          OR c.last_name ILIKE $${index} ESCAPE '\\'
          OR c.email ILIKE $${index} ESCAPE '\\'
          OR kd.original_filename ILIKE $${index} ESCAPE '\\'
        )`)
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : ''

      const result = await db.query(
        `
          SELECT
            kd.id,
            kd.customer_id,
            kd.application_id,
            kd.document_type,
            kd.document_status,
            kd.original_filename,
            kd.mime_type,
            kd.file_size_bytes,
            kd.document_last4,
            kd.uploaded_at,
            kd.reviewed_at,
            kd.review_notes,
            kd.reviewed_by_staff_id,
            c.customer_number,
            c.first_name,
            c.last_name,
            c.email,
            cp.kyc_status AS customer_kyc_status
          FROM kyc_documents kd
          LEFT JOIN customers c
            ON c.id = kd.customer_id
          LEFT JOIN customer_profiles cp
            ON cp.customer_id = kd.customer_id
          ${where}
          ORDER BY
            CASE kd.document_status
              WHEN 'pending' THEN 1
              WHEN 'rejected' THEN 2
              WHEN 'approved' THEN 3
              ELSE 4
            END,
            kd.uploaded_at DESC
          LIMIT 250
        `,
        values,
      )

      return res.status(200).json({
        ok: true,
        documents: result.rows,
      })
    }

    const documentId = String(req.body?.documentId ?? '').trim()
    const status = String(req.body?.status ?? '').trim()
    const reviewNotes = req.body?.reviewNotes == null
      ? null
      : String(req.body.reviewNotes).trim().slice(0, 2000)

    if (!UUID_PATTERN.test(documentId)) {
      return res.status(400).json({
        ok: false,
        error: 'A valid document ID is required.',
      })
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        ok: false,
        error: 'Choose approved or rejected.',
      })
    }

    if (status === 'rejected' && (!reviewNotes || reviewNotes.length < 3)) {
      return res.status(400).json({
        ok: false,
        error: 'A review note of at least 3 characters is required for rejection.',
      })
    }

    const client = await db.connect()

    let customerId: string | null = null

    try {
      await client.query('BEGIN')

      const existing = await client.query(
        `SELECT id, customer_id, document_status, document_type
         FROM kyc_documents
         WHERE id = $1
         FOR UPDATE`,
        [documentId],
      )

      if (existing.rowCount !== 1) {
        await client.query('ROLLBACK')
        return res.status(404).json({
          ok: false,
          error: 'KYC document not found.',
        })
      }

      const document = existing.rows[0]
      customerId = document.customer_id

      if (document.document_status !== 'pending') {
        await client.query('ROLLBACK')
        return res.status(409).json({
          ok: false,
          error: 'Only pending KYC documents can be reviewed.',
        })
      }

      const updated = await client.query(
        `UPDATE kyc_documents
         SET document_status = $1,
             reviewed_by_staff_id = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             review_notes = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
           AND document_status = 'pending'
         RETURNING id, customer_id, document_type,
                   document_status, reviewed_at`,
        [status, user.id, reviewNotes, documentId],
      )

      if (updated.rowCount !== 1) {
        throw new Error('KYC document review could not be saved.')
      }

      // Deliberately do not mark the entire customer profile verified here.
      // Document approval alone does not establish that all bank KYC
      // requirements have been satisfied.

      // Keep the staff audit record in the same transaction as the
      // document decision so neither can succeed without the other.
      const forwardedFor = req.headers['x-forwarded-for']
      const ipAddress = (
        typeof forwardedFor === 'string'
          ? forwardedFor.split(',')[0].trim()
          : Array.isArray(forwardedFor)
            ? forwardedFor[0]
            : null
      ) ?? req.socket?.remoteAddress ?? null

      await client.query(
        `INSERT INTO audit_logs (
           id, actor_customer_id, action, resource_type, resource_id,
           description, ip_address, user_agent, metadata
         )
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          `kyc.document.${status}`,
          'kyc_document',
          documentId,
          `KYC document ${status} by management staff.`,
          ipAddress,
          req.headers['user-agent'] ?? null,
          JSON.stringify({
            documentId,
            customerId,
            status,
            reviewNotes,
            actorStaffId: user.id,
          }),
        ],
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }

    return res.status(200).json({
      ok: true,
      message: `KYC document ${status}.`,
    })
  } catch (error) {
    console.error('Management KYC request failed:', error)
    return res.status(500).json({
      ok: false,
      error: 'Unable to process the management KYC request.',
    })
  }
}
