import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { runner } from 'node-pg-migrate'
import { Client } from 'pg'

test('account and session migration', async (context) => {
  assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL before running database tests.')
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  // A schema is a namespace for tables. Tests never touch the app's public tables.
  const schema = `quizzent_test_${randomUUID().replaceAll('-', '')}`
  await client.connect()
  let schemaCreated = false

  const migrate = (direction: 'up' | 'down') => runner({
    dbClient: client,
    dir: resolve('server/migrations'),
    migrationsTable: 'pgmigrations',
    migrationsSchema: schema,
    schema,
    direction,
    count: direction === 'down' ? 4 : undefined,
    verbose: false,
    log: () => {},
  })

  async function rejectsWrite(sql: string, values: unknown[], code: string) {
    // A rejected SQL write aborts its transaction; restore this savepoint to continue.
    await client.query('SAVEPOINT rejected_write')
    try {
      await assert.rejects(client.query(sql, values), { code })
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT rejected_write')
      await client.query('RELEASE SAVEPOINT rejected_write')
    }
  }

  try {
    await client.query(`CREATE SCHEMA "${schema}"`)
    schemaCreated = true

    await context.test('applies once to a fresh schema', async () => {
      assert.equal((await migrate('up')).length, 4)
      assert.equal((await migrate('up')).length, 0)
    })

    await client.query('BEGIN')
    const insertUser = 'INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, role, status'
    const { rows: [user] } = await client.query(insertUser, ['Test Organiser', 'organiser@example.test', 'test-fixture-hash'])

    await context.test('defaults to organiser and rejects duplicate emails regardless of case', async () => {
      assert.equal(user.role, 'organiser')
      assert.equal(user.status, 'active')
      await rejectsWrite(insertUser, ['Other Name', 'ORGANISER@example.test', 'test-fixture-hash'], '23505')
    })

    await context.test('rejects invalid account values', async () => {
      await rejectsWrite('UPDATE users SET role = $1 WHERE id = $2', ['competitor', user.id], '23514')
      await rejectsWrite('UPDATE users SET status = $1 WHERE id = $2', ['unknown', user.id], '23514')
      await rejectsWrite('UPDATE users SET display_name = $1 WHERE id = $2', ['   ', user.id], '23514')
      await rejectsWrite('UPDATE users SET password_hash = NULL WHERE id = $1', [user.id], '23502')
    })

    const insertSession = "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')"
    const tokenHash = 'a'.repeat(64)

    await context.test('rejects orphan sessions, malformed hashes, and invalid expiry', async () => {
      await rejectsWrite(insertSession, [randomUUID(), tokenHash], '23503')
      await rejectsWrite(insertSession, [user.id, 'not-a-token-hash'], '23514')
      await rejectsWrite("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now())", [user.id, tokenHash], '23514')
    })

    await context.test('rejects duplicate session tokens and removes sessions with their account', async () => {
      await client.query(insertSession, [user.id, tokenHash])
      await rejectsWrite(insertSession, [user.id, tokenHash], '23505')
      await client.query('DELETE FROM users WHERE id = $1', [user.id])
      const { rows: [result] } = await client.query('SELECT count(*)::integer AS count FROM user_sessions WHERE user_id = $1', [user.id])
      assert.equal(result.count, 0)
    })

    await context.test('enforces draft ownership, defaults, and field constraints', async () => {
      const { rows: [owner] } = await client.query(insertUser, ['Draft Owner', 'draft@example.test', 'test-fixture-hash'])
      const insert = 'INSERT INTO competitions (organiser_id, title) VALUES ($1, $2) RETURNING *'
      const { rows: [draft] } = await client.query(insert, [owner.id, 'Friday Brainstorm'])
      assert.equal(draft.question_time_seconds, 10)
      assert.equal(draft.description, '')
      assert.equal(draft.status, 'draft')
      await rejectsWrite(insert, [randomUUID(), 'Missing owner'], '23503')
      for (const title of ['', ' padded ', 'x'.repeat(101)]) await rejectsWrite(insert, [owner.id, title], '23514')
      await rejectsWrite('UPDATE competitions SET description = $1 WHERE id = $2', ['x'.repeat(501), draft.id], '23514')
      for (const seconds of [4, 121]) await rejectsWrite('UPDATE competitions SET question_time_seconds = $1 WHERE id = $2', [seconds, draft.id], '23514')
      await rejectsWrite("UPDATE competitions SET status = 'published' WHERE id = $1", [draft.id], '23514')
      await client.query('DELETE FROM users WHERE id = $1', [owner.id])
      assert.equal((await client.query('SELECT id FROM competitions WHERE id = $1', [draft.id])).rowCount, 0)
    })

    await client.query('ROLLBACK')

    await context.test('can roll back and reapply in the disposable schema', async () => {
      assert.equal((await migrate('down')).length, 4)
      const { rows: [tables] } = await client.query("SELECT to_regclass($1) AS users, to_regclass($2) AS sessions", [`${schema}.users`, `${schema}.user_sessions`])
      assert.equal(tables.users, null)
      assert.equal(tables.sessions, null)
      assert.equal((await migrate('up')).length, 4)
    })
  } finally {
    try {
      if (schemaCreated) {
        await client.query('ROLLBACK')
        // Remove only the random namespace created by this test run.
        await client.query(`DROP SCHEMA "${schema}" CASCADE`)
      }
    } finally {
      await client.end()
    }
  }
})
