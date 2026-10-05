import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import { URL } from 'node:url'
import { Client } from 'pg'

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return

  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')

    if (separator < 0) continue

    const key = trimmed.slice(0, separator)
    let value = trimmed.slice(separator + 1)

    if (
      value.length >= 2 &&
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile('.env.local')

const bootstrapConfirm = String(
  process.env.NORTHSTAR_BOOTSTRAP_CONFIRM ?? '',
).trim()

if (bootstrapConfirm != 'YES') {
  throw new Error(
    'Bootstrap blocked. Set NORTHSTAR_BOOTSTRAP_CONFIRM=YES explicitly to authorize the one-time Super Manager bootstrap.',
  )
}

const email = String(process.env.NORTHSTAR_SUPER_MANAGER_EMAIL ?? '')
  .trim()
  .toLowerCase()

const password = String(
  process.env.NORTHSTAR_SUPER_MANAGER_PASSWORD ?? '',
)

const firstName = String(
  process.env.NORTHSTAR_SUPER_MANAGER_FIRST_NAME ?? '',
)
  .trim()

const lastName = String(
  process.env.NORTHSTAR_SUPER_MANAGER_LAST_NAME ?? '',
)
  .trim()

const phone = String(
  process.env.NORTHSTAR_SUPER_MANAGER_PHONE ?? '',
).trim()

if (!email || !password || !firstName || !lastName) {
  throw new Error(
    'NORTHSTAR_SUPER_MANAGER_EMAIL, NORTHSTAR_SUPER_MANAGER_PASSWORD, NORTHSTAR_SUPER_MANAGER_FIRST_NAME, and NORTHSTAR_SUPER_MANAGER_LAST_NAME are required.',
  )
}

if (password.length < 12 || password.length > 128) {
  throw new Error('Super Manager password must be 12-128 characters.')
}

if (!/[A-Z]/.test(password)) {
  throw new Error('Super Manager password must contain an uppercase letter.')
}

if (!/[a-z]/.test(password)) {
  throw new Error('Super Manager password must contain a lowercase letter.')
}

if (!/[0-9]/.test(password)) {
  throw new Error('Super Manager password must contain a number.')
}

if (!/[^A-Za-z0-9]/.test(password)) {
  throw new Error(
    'Super Manager password must contain a special character.',
  )
}

const databaseUrl =
  process.env.DATABASE_POSTGRES_URL ||
  process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'DATABASE_POSTGRES_URL or DATABASE_URL is required.',
  )
}

const url = new URL(databaseUrl)

url.searchParams.delete('sslmode')
url.searchParams.delete('uselibpqcompat')

const client = new Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  await client.query('BEGIN')

  // Serialize the one-time bootstrap so concurrent executions cannot race.
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('northstar.super_manager.bootstrap'))",
  )

  const existingSuperManager = await client.query(`
    SELECT id, email
    FROM customers
    WHERE role = 'super_manager'
    LIMIT 1
    FOR UPDATE
  `)

  if (existingSuperManager.rowCount > 0) {
    throw new Error(
      'A Super Manager already exists. Bootstrap refused to modify the existing account.',
    )
  }

  const existingEmail = await client.query(
    `
      SELECT id, email, role
      FROM customers
      WHERE LOWER(email) = $1
      LIMIT 1
      FOR UPDATE
    `,
    [email],
  )

  if (existingEmail.rowCount > 0) {
    throw new Error(
      `The email ${email} already belongs to an existing customer. Bootstrap will not overwrite it.`,
    )
  }

  const sequenceResult = await client.query(`
    SELECT nextval('staff_id_sequence') AS sequence_number
  `)

  const sequenceNumber = Number(
    sequenceResult.rows[0].sequence_number,
  )

  const staffId = `STF-${String(sequenceNumber).padStart(6, '0')}`

  const customerNumberResult = await client.query(`
    SELECT
      'NSCUS' ||
      TO_CHAR(NOW(), 'YYMMDDHH24MISSMS') ||
      UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6))
      AS customer_number
  `)

  const customerNumber =
    customerNumberResult.rows[0].customer_number

  const passwordHash = await bcrypt.hash(password, 12)

  const customerResult = await client.query(
    `
      INSERT INTO customers (
        customer_number,
        first_name,
        last_name,
        email,
        phone,
        password_hash,
        status,
        role,
        two_factor_enabled,
        employee_number,
        department,
        staff_status,
        approved_at,
        staff_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'active',
        'super_manager',
        FALSE,
        $7,
        'Executive Management',
        'active',
        CURRENT_TIMESTAMP,
        $8
      )
      RETURNING
        id,
        customer_number,
        first_name,
        last_name,
        email,
        role,
        staff_id
    `,
    [
      customerNumber,
      firstName,
      lastName,
      email,
      phone || null,
      passwordHash,
      staffId,
      staffId,
    ],
  )

  const customer = customerResult.rows[0]

  const roleResult = await client.query(`
    SELECT id
    FROM management_roles
    WHERE role_key = 'super_manager'
      AND is_active = TRUE
    LIMIT 1
  `)

  if (roleResult.rowCount !== 1) {
    throw new Error(
      'The active Super Manager management role does not exist.',
    )
  }

  await client.query(
    `
      INSERT INTO staff_role_assignments (
        customer_id,
        role_id,
        assigned_by
      )
      VALUES ($1, $2, NULL)
      ON CONFLICT DO NOTHING
    `,
    [customer.id, roleResult.rows[0].id],
  )

  const permissionCountResult = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM management_role_permissions rp
      JOIN management_roles r
        ON r.id = rp.role_id
      WHERE r.role_key = 'super_manager'
    `,
  )

  const permissionCount =
    permissionCountResult.rows[0].count

  await client.query(
    `
      INSERT INTO audit_logs (
        actor_customer_id,
        action,
        resource_type,
        resource_id,
        description,
        metadata
      )
      VALUES (
        NULL,
        'management.super_manager.bootstrap',
        'customer',
        $1,
        $2,
        $3::jsonb
      )
    `,
    [
      customer.id,
      'Initial Super Manager account provisioned through the controlled system bootstrap process.',
      JSON.stringify({
        customerNumber: customer.customer_number,
        staffId: customer.staff_id,
        role: customer.role,
        department: 'Executive Management',
        permissionCount,
        bootstrap: true,
      }),
    ],
  )

  await client.query('COMMIT')

  console.log('')
  console.log('Super Manager bootstrap completed successfully.')
  console.log(`Customer Number: ${customer.customer_number}`)
  console.log(`Staff ID:        ${customer.staff_id}`)
  console.log(`Name:            ${customer.first_name} ${customer.last_name}`)
  console.log(`Email:           ${customer.email}`)
  console.log(`Role:            ${customer.role}`)
  console.log('Department:      Executive Management')
  console.log('Status:          active')
  console.log(`Permissions:     ${permissionCount}`)
  console.log('')
  console.log(
    'The password was not printed and was not stored in source code.',
  )
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
