import assert from 'node:assert/strict'
import { randomUUID, scrypt } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { runner } from 'node-pg-migrate'
import { Client, Pool } from 'pg'
import { createApp } from '../src/app.js'

test('organiser signup API', async (context) => {
  assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL before running API tests.')
  const schema = `quizzent_signup_test_${randomUUID().replaceAll('-', '')}`
  const admin = new Client({ connectionString: process.env.DATABASE_URL })
  await admin.connect()
  let pool: Pool | undefined
  let schemaCreated = false

  async function withApi(run: (url: string) => Promise<void>, database = pool!) {
    const server = createApp(database).listen(0, '127.0.0.1')
    try {
      await once(server, 'listening')
      await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/signup`)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  }

  const password = 'a long test passphrase with spaces '
  const details = (email: string) => ({ displayName: 'Test Organiser', email, password })
  const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    schemaCreated = true
    await runner({ dbClient: admin, dir: resolve('server/migrations'), migrationsTable: 'pgmigrations', migrationsSchema: schema, schema, direction: 'up', log: () => {}, verbose: false })
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 5 })

    await context.test('creates only a safe organiser response and stores a verifiable salted hash', () => withApi(async url => {
      const response = await post(url, { ...details('  FIRST@EXAMPLE.TEST  '), displayName: '  First Organiser  ' })
      assert.equal(response.status, 201)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('set-cookie'), null)
      const { user } = await response.json()
      assert.deepEqual(Object.keys(user).sort(), ['displayName', 'email', 'id', 'role'])
      assert.equal(user.displayName, 'First Organiser')
      assert.equal(user.email, 'first@example.test')
      assert.equal(user.role, 'organiser')
      const { rows: [stored] } = await pool!.query('SELECT password_hash FROM users WHERE id = $1', [user.id])
      const [algorithm, n, r, p, salt, hash] = stored.password_hash.split('$')
      assert.equal(algorithm, 'scrypt')
      assert.equal(salt.length, 32)
      assert.ok(!stored.password_hash.includes(password))
      const derived = await new Promise<Buffer>((resolve, reject) => {
        scrypt(password, Buffer.from(salt, 'hex'), 64, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
      })
      assert.equal(derived.toString('hex'), hash)
      await post(url, details('second@example.test'))
      const { rows } = await pool!.query('SELECT password_hash FROM users')
      assert.equal(new Set(rows.map(row => row.password_hash)).size, 2)
    }))

    await context.test('rejects invalid fields and privilege injection before inserting', () => withApi(async url => {
      for (const body of [details('not-an-email'), { ...details('invalid@example.test'), password: 'short' }, { ...details('invalid@example.test'), displayName: '   ' }, { ...details('invalid@example.test'), role: 'superadmin' }]) {
        assert.equal((await post(url, body)).status, 400)
      }
      const response = await post(url, { ...details('invalid@example.test'), password: 'short' })
      assert.ok((await response.json()).fieldErrors.password)
      const { rows: [result] } = await pool!.query('SELECT count(*)::integer AS count FROM users')
      assert.equal(result.count, 2)
    }))

    await context.test('settles simultaneous case-insensitive duplicate signups with one account', () => withApi(async url => {
      const responses = await Promise.all([post(url, details('race@example.test')), post(url, details('RACE@example.test'))])
      assert.deepEqual(responses.map(response => response.status).sort(), [201, 409])
      const conflict = await responses.find(response => response.status === 409)!.json()
      assert.ok(conflict.fieldErrors.email)
      const { rows: [result] } = await pool!.query("SELECT count(*)::integer AS count FROM users WHERE email = 'race@example.test'")
      assert.equal(result.count, 1)
    }))

    await context.test('returns JSON errors for malformed, oversized, and unsupported requests', () => withApi(async url => {
      assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400)
      assert.equal((await post(url, { value: 'x'.repeat(9000) })).status, 413)
      assert.equal((await fetch(url, { method: 'POST', body: 'not JSON' })).status, 415)
    }))

    await context.test('rate-limits signup without changing the database', () => withApi(async url => {
      for (let i = 0; i < 10; i++) assert.equal((await post(url, {})).status, 400)
      const blocked = await post(url, details('blocked@example.test'))
      assert.equal(blocked.status, 429)
      assert.ok(blocked.headers.get('retry-after'))
    }))

    await context.test('does not expose internal errors when database access fails', async () => {
      const closedPool = new Pool()
      await closedPool.end()
      await withApi(async url => {
        const response = await post(url, details('failure@example.test'))
        assert.equal(response.status, 500)
        assert.deepEqual(await response.json(), { message: 'Something went wrong. Please try again later.' })
      }, closedPool)
    })
  } finally {
    await pool?.end()
    try {
      if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
    } finally {
      await admin.end()
    }
  }
})
