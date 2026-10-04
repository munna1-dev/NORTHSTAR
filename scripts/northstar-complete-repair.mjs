import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const stamp = new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, '')
  .slice(0, 14)

const backup = path.join(
  root,
  '.northstar-backup',
  `complete-repair-${stamp}`,
)

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function backupFile(relative) {
  const source = path.join(root, relative)

  if (!fs.existsSync(source)) {
    return
  }

  const destination = path.join(backup, relative)
  ensureDir(path.dirname(destination))
  fs.copyFileSync(source, destination)
}

function writeFile(relative, content) {
  const destination = path.join(root, relative)
  ensureDir(path.dirname(destination))
  fs.writeFileSync(destination, content)
}

console.log('============================================================')
console.log(' NORTHSTARBANK COMPLETE REPAIR')
console.log('============================================================')
console.log(`Backup: ${backup}`)

const protectedFiles = [
  'package.json',
  'vercel.json',
  'src/server/auth/session.ts',
  'src/lib/session.ts',
  'src/lib/customerApi.ts',
  'src/components/ManagementShell.tsx',
  'src/pages/CustomerDashboardPage.tsx',
  'src/pages/CustomerDashboardPage.css',
  'src/pages/management/ManagementOperationsPage.tsx',
  'api/auth/login.ts',
  'api/auth/logout.ts',
  'api/management/applications.ts',
  'api/management/customers.ts',
  'api/management/operations.ts',
  'src/types/index.ts',
]

ensureDir(backup)

for (const file of protectedFiles) {
  backupFile(file)
}

console.log('Backup completed.')

writeFile(
  'src/server/security/request.ts',
  `import type { VercelRequest } from '@vercel/node'

function firstForwardedValue(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value

  if (!raw) {
    return null
  }

  const first = raw.split(',')[0]?.trim()

  if (!first) {
    return null
  }

  if (/^(?:\\\\d{1,3}\\\\.){3}\\\\d{1,3}$/.test(first)) {
    return first
  }

  if (first.includes(':') && /^[0-9a-fA-F:.]+$/.test(first)) {
    return first
  }

  return null
}

export function getClientIp(
  request: VercelRequest,
): string | null {
  return (
    firstForwardedValue(request.headers['x-forwarded-for']) ??
    firstForwardedValue(request.headers['x-real-ip'])
  )
}

export function getUserAgent(
  request: VercelRequest,
): string | null {
  const value = request.headers['user-agent']

  if (Array.isArray(value)) {
    return value[0]?.slice(0, 1000) ?? null
  }

  return typeof value === 'string'
    ? value.slice(0, 1000)
    : null
}

export function isStateChangingMethod(
  method: string | undefined,
): boolean {
  return (
    method === 'POST' ||
    method === 'PUT' ||
    method === 'PATCH' ||
    method === 'DELETE'
  )
}
`,
)

writeFile(
  'api/security-headers.ts',
  `import type { VercelResponse } from '@vercel/node'

export function applySecurityHeaders(
  res: VercelResponse,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader(
    'Referrer-Policy',
    'strict-origin-when-cross-origin',
  )
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  )
}
`,
)

writeFile(
  'database/009_auth_security_hardening.sql',
  `-- NorthStarBank authentication/security hardening.
-- PostgreSQL. Additive only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_created
  ON auth_login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_created
  ON auth_login_attempts(ip_address, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  challenge_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_mfa_challenges_customer
  ON auth_mfa_challenges(customer_id, created_at DESC);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER
  NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_customers_login_locked_until
  ON customers(login_locked_until);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_expires
  ON customer_sessions(customer_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_customer_security_events_created
  ON customer_security_events(created_at DESC);
`,
)

const vercelConfig = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  headers: [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value:
            'camera=(), microphone=(), geolocation=(), payment=()',
        },
        {
          key: 'Strict-Transport-Security',
          value:
            'max-age=31536000; includeSubDomains',
        },
      ],
    },
  ],
  rewrites: [
    {
      source: '/((?!api(?:/|$)).*)',
      destination: '/index.html',
    },
  ],
}

writeFile(
  'vercel.json',
  `${JSON.stringify(vercelConfig, null, 2)}\\n`,
)

const packagePath = path.join(root, 'package.json')
const packageJson = JSON.parse(
  fs.readFileSync(packagePath, 'utf8'),
)

packageJson.scripts = {
  ...packageJson.scripts,
  'db:migrate': 'node scripts/migrate-postgres.mjs',
}

fs.writeFileSync(
  packagePath,
  `${JSON.stringify(packageJson, null, 2)}\\n`,
)

writeFile(
  'scripts/migrate-postgres.mjs',
  `import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not configured. Migration not executed.',
  )
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10000,
})

const client = await pool.connect()

try {
  await client.query(\`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  \`)

  const databaseDir = path.resolve('database')

  const files = (await fs.readdir(databaseDir))
    .filter((file) => /^\\\\d{3}_.*\\\\.sql$/.test(file))
    .sort()

  /*
   * 001-003 are historical SQLite-era migrations.
   * They are intentionally excluded from this PostgreSQL runner.
   */
  const postgresFiles = files.filter(
    (file) => Number(file.slice(0, 3)) >= 4,
  )

  for (const file of postgresFiles) {
    const version = file.slice(0, 3)

    const exists = await client.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version],
    )

    if (exists.rowCount) {
      console.log('SKIP', file)
      continue
    }

    console.log('APPLY', file)

    const sql = await fs.readFile(
      path.join(databaseDir, file),
      'utf8',
    )

    await client.query('BEGIN')

    try {
      await client.query(sql)

      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version],
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }

  console.log('PostgreSQL migration pass complete.')
} finally {
  client.release()
  await pool.end()
}
`,
)

console.log('')
console.log('Files created:')
console.log('  src/server/security/request.ts')
console.log('  api/security-headers.ts')
console.log('  database/009_auth_security_hardening.sql')
console.log('  scripts/migrate-postgres.mjs')
console.log('  vercel.json updated')
console.log('  package.json updated')
console.log('')
console.log('IMPORTANT: No database connection was made.')
console.log('IMPORTANT: Existing customer/management code was not overwritten.')
console.log('')
console.log('Repair preparation completed successfully.')
