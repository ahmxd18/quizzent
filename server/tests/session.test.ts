import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { runner } from 'node-pg-migrate'
import { Client, Pool } from 'pg'
import { createApp } from '../src/app.js'
import { createOrganiser } from '../src/features/auth/signup.service.js'

test('organiser login and sessions', async context => {
  assert.ok(process.env.DATABASE_URL)
  const schema = `quizzent_session_test_${randomUUID().replaceAll('-', '')}`
  const admin = new Client({ connectionString: process.env.DATABASE_URL })
  await admin.connect()
  let pool: Pool | undefined
  let created = false
  const password = 'session test passphrase with spaces '
  const post = (url: string, body: unknown = {}, cookie?: string) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Quizzent-Request': '1', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  })
  const details = { email: 'session@example.test', password }
  async function withApi(run: (base: string) => Promise<void>) {
    const server = createApp(pool!).listen(0, '127.0.0.1')
    try {
      await once(server, 'listening')
      await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`)
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
  }
  async function login(base: string, oldCookie?: string) {
    const response = await post(`${base}/login`, details, oldCookie)
    assert.equal(response.status, 200)
    return response.headers.get('set-cookie')!.split(';')[0]
  }
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    created = true
    await runner({ dbClient: admin, dir: resolve('server/migrations'), migrationsTable: 'pgmigrations', migrationsSchema: schema, schema, direction: 'up', log: () => {}, verbose: false })
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 5 })
    const account = await createOrganiser(pool, { displayName: 'Session Tester', ...details })

    await context.test('logs in with normalised email, safe response, and hashed cookie token', () => withApi(async base => {
      const response = await post(`${base}/login`, { ...details, email: ' SESSION@EXAMPLE.TEST ' })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { user: account })
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const header = response.headers.get('set-cookie')!
      assert.match(header, /HttpOnly/)
      assert.match(header, /SameSite=Lax/)
      assert.match(header, /Max-Age=86400/)
      const cookie = header.split(';')[0]
      const token = cookie.split('=')[1]
      const digest = createHash('sha256').update(token).digest('hex')
      const { rows } = await pool!.query('SELECT token_hash FROM user_sessions WHERE token_hash = $1', [digest])
      assert.equal(rows.length, 1)
      assert.notEqual(rows[0].token_hash, token)
      const restored = await fetch(`${base}/session`, { headers: { Cookie: cookie } })
      assert.equal(restored.status, 200)
      assert.deepEqual(await restored.json(), { user: account })
    }))

    await context.test('gives the same failure for wrong, unknown, and suspended accounts', () => withApi(async base => {
      const wrong = await post(`${base}/login`, { ...details, password: 'wrong password' })
      const unknown = await post(`${base}/login`, { ...details, email: 'missing@example.test' })
      assert.equal(wrong.status, 401)
      assert.equal(unknown.status, 401)
      assert.deepEqual(await wrong.json(), await unknown.json())
      assert.equal(wrong.headers.get('set-cookie'), null)
      await pool!.query("UPDATE users SET status = 'suspended' WHERE id = $1", [account.id])
      assert.equal((await post(`${base}/login`, details)).status, 401)
      await pool!.query("UPDATE users SET status = 'active' WHERE id = $1", [account.id])
      assert.equal((await post(`${base}/login`, { ...details, password: password.trim() })).status, 401)
    }))

    await context.test('rotates this browser session and logout revokes the replacement', () => withApi(async base => {
      const old = await login(base)
      const fresh = await login(base, old)
      assert.notEqual(old, fresh)
      const get = (cookie: string) => fetch(`${base}/session`, { headers: { Cookie: cookie } })
      assert.equal((await get(old)).status, 401)
      const logout = await post(`${base}/logout`, {}, fresh)
      assert.equal(logout.status, 200)
      assert.match(logout.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/)
      assert.equal((await get(fresh)).status, 401)
      assert.equal((await post(`${base}/logout`, {}, fresh)).status, 200)
    }))

    await context.test('rejects missing, forged, expired, and suspended sessions', () => withApi(async base => {
      assert.equal((await fetch(`${base}/session`)).status, 401)
      assert.equal((await fetch(`${base}/session`, { headers: { Cookie: `quizzent_session=${'a'.repeat(64)}` } })).status, 401)
      const cookie = await login(base)
      const get = () => fetch(`${base}/session`, { headers: { Cookie: cookie } })
      await pool!.query("UPDATE users SET status = 'suspended' WHERE id = $1", [account.id])
      assert.equal((await get()).status, 401)
      await pool!.query("UPDATE users SET status = 'active' WHERE id = $1", [account.id])
      await pool!.query("UPDATE user_sessions SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day'")
      assert.equal((await get()).status, 401)
    }))

    await context.test('blocks cross-site writes and validates bounded JSON inputs', () => withApi(async base => {
      assert.equal((await fetch(`${base}/login`, { method: 'POST' })).status, 403)
      assert.equal((await fetch(`${base}/logout`, { method: 'POST' })).status, 403)
      assert.equal((await fetch(`${base}/logout`, { method: 'POST', headers: { 'X-Quizzent-Request': '1', 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
      assert.equal((await post(`${base}/login`, { ...details, role: 'superadmin' })).status, 400)
      assert.equal((await post(`${base}/login`, { ...details, password: '' })).status, 400)
      assert.equal((await post(`${base}/login`, { password: 'x'.repeat(9000) })).status, 413)
      assert.equal((await fetch(`${base}/login`, { method: 'POST', headers: { 'X-Quizzent-Request': '1', 'Content-Type': 'application/json' }, body: '{' })).status, 400)
      assert.equal((await fetch(`${base}/login`, { method: 'POST', headers: { 'X-Quizzent-Request': '1' } })).status, 415)
    }))

    await context.test('limits repeated login attempts', () => withApi(async base => {
      for (let i = 0; i < 10; i++) assert.equal((await post(`${base}/login`, {})).status, 400)
      const response = await post(`${base}/login`, details)
      assert.equal(response.status, 429)
      assert.ok(response.headers.get('retry-after'))
    }))

    await context.test('sets a host-only Secure cookie in production', async () => {
      const previous = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      try {
        await withApi(async base => {
          const response = await post(`${base}/login`, details)
          assert.equal(response.status, 200)
          const cookie = response.headers.get('set-cookie')!
          assert.match(cookie, /^__Host-quizzent_session=/)
          assert.match(cookie, /; Secure/)
          assert.doesNotMatch(cookie, /Domain=/)
        })
      } finally {
        if (previous === undefined) delete process.env.NODE_ENV
        else process.env.NODE_ENV = previous
      }
    })
  } finally {
    await pool?.end()
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`) }
    finally { await admin.end() }
  }
})
