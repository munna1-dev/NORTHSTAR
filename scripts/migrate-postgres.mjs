import fs from 'node:fs/promises'
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
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const databaseDir = path.resolve('database')

  const files = (await fs.readdir(databaseDir))
    .filter((file) => /^\\d{3}_.*\\.sql$/.test(file))
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
