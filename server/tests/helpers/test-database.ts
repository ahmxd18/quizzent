import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { runner } from 'node-pg-migrate'
import { Client, Pool } from 'pg'

export async function testDatabase() {
  assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL before running database checks.')
  const schema = `quizzent_check_${randomUUID().replaceAll('-', '')}`
  const admin = new Client({ connectionString: process.env.DATABASE_URL })
  await admin.connect()
  let pool: Pool | undefined
  try {
    // A schema is a separate namespace: these checks never touch your normal tables.
    await admin.query(`CREATE SCHEMA "${schema}"`)
    await runner({ dbClient: admin, dir: resolve('server/migrations'), migrationsTable: 'pgmigrations', migrationsSchema: schema, schema, direction: 'up', log: () => {}, verbose: false })
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 5 })
    return { pool, async close() {
      await pool!.end()
      try { await admin.query(`DROP SCHEMA "${schema}" CASCADE`) } finally { await admin.end() }
    } }
  } catch (error) {
    await pool?.end()
    try { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`) } finally { await admin.end() }
    throw error
  }
}
