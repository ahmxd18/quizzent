import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { runner } from 'node-pg-migrate'
import { Client, Pool } from 'pg'
import { createApp } from '../src/app.js'
import { createOrganiser } from '../src/features/auth/signup.service.js'
import { createSession } from '../src/features/auth/session.service.js'

test('competition drafts API', async context => {
  assert.ok(process.env.DATABASE_URL)
  const schema = `quizzent_drafts_test_${randomUUID().replaceAll('-', '')}`
  const admin = new Client({ connectionString: process.env.DATABASE_URL })
  await admin.connect()
  let pool: Pool | undefined
  let created = false
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    created = true
    await runner({ dbClient: admin, dir: resolve('server/migrations'), migrationsTable: 'pgmigrations', migrationsSchema: schema, schema, direction: 'up', log: () => {}, verbose: false })
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 5 })
    const owner = await createOrganiser(pool, { displayName: 'Draft Owner', email: 'owner@example.test', password: 'long competition test passphrase' })
    const other = await createOrganiser(pool, { displayName: 'Other Owner', email: 'other@example.test', password: 'another competition test passphrase' })
    const cookieName = process.env.NODE_ENV === 'production' ? '__Host-quizzent_session' : 'quizzent_session'
    const cookie = `${cookieName}=${await createSession(pool, owner.id)}`
    const otherCookie = `${cookieName}=${await createSession(pool, other.id)}`
    server = createApp(pool).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/competitions`
    const send = (path = '', method = 'GET', body?: unknown, session = cookie) => fetch(`${base}${path}`, {
      method, headers: { Cookie: session, 'Content-Type': 'application/json', 'X-Quizzent-Request': '1' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    let draftId: string

    await context.test('rejects unauthenticated access and cross-site writes', async () => {
      assert.equal((await fetch(base)).status, 401)
      assert.equal((await send('', 'POST', { title: 'No session' }, '')).status, 401)
      assert.equal((await fetch(base, { method: 'POST', headers: { Cookie: cookie } })).status, 403)
      assert.equal((await fetch(`${base}/${randomUUID()}`, { method: 'PUT', headers: { Cookie: cookie, 'X-Quizzent-Request': '1', 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
    })

    await context.test('starts empty and creates a normalised private draft with defaults', async () => {
      assert.deepEqual(await (await send()).json(), { competitions: [] })
      const response = await send('', 'POST', { title: '  Friday Brainstorm  ' })
      assert.equal(response.status, 201)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const { competition } = await response.json()
      draftId = competition.id
      assert.equal(competition.title, 'Friday Brainstorm')
      assert.equal(competition.description, '')
      assert.equal(competition.questionTimeSeconds, 10)
      assert.equal(competition.status, 'draft')
      assert.ok(competition.createdAt && competition.updatedAt)
      assert.equal(competition.organiserId, undefined)
      assert.equal((await pool!.query('SELECT organiser_id FROM competitions WHERE id = $1', [draftId])).rows[0].organiser_id, owner.id)
      assert.equal((await send(`/${draftId}`)).status, 200)
    })

    await context.test('hides other organisers drafts on list, read, and update', async () => {
      assert.deepEqual(await (await send('', 'GET', undefined, otherCookie)).json(), { competitions: [] })
      const hidden = await send(`/${draftId}`, 'GET', undefined, otherCookie)
      const missing = await send(`/${randomUUID()}`)
      assert.equal(hidden.status, 404)
      assert.deepEqual(await hidden.json(), await missing.json())
      assert.equal((await send(`/${draftId}`, 'PUT', { title: 'Stolen' }, otherCookie)).status, 404)
      assert.equal((await send('', 'POST', { title: 'Injected', organiserId: other.id })).status, 400)
      assert.equal((await send('', 'POST', { title: 'Injected', status: 'published' })).status, 400)
      assert.equal((await send(`/${draftId}`)).status, 200)
    })

    await context.test('validates lengths, integer limits, IDs, and JSON', async () => {
      for (const body of [{ title: ' ' }, { title: 'x'.repeat(101) }, { title: 'Test', description: 'x'.repeat(501) },
        ...[4, 121, 10.5, '10'].map(questionTimeSeconds => ({ title: 'Test', questionTimeSeconds }))]) {
        assert.equal((await send('', 'POST', body)).status, 400)
      }
      const invalid = await send('', 'POST', { title: '' })
      assert.ok((await invalid.json()).fieldErrors.title)
      assert.equal((await send('/bad-id')).status, 400)
      assert.equal((await send('/bad-id', 'PUT', { title: 'Title' })).status, 400)
      assert.equal((await send('', 'POST', { title: 'x'.repeat(9000) })).status, 413)
      assert.equal((await fetch(base, { method: 'POST', headers: { Cookie: cookie, 'X-Quizzent-Request': '1', 'Content-Type': 'application/json' }, body: '{' })).status, 400)
      assert.equal((await fetch(base, { method: 'POST', headers: { Cookie: cookie, 'X-Quizzent-Request': '1' }, body: 'text' })).status, 415)
    })

    await context.test('saves edits, preserves creation date, and sorts by most recent update', async () => {
      const { competition: before } = await (await send(`/${draftId}`)).json()
      await send('', 'POST', { title: 'Second draft', questionTimeSeconds: 120 })
      const response = await send(`/${draftId}`, 'PUT', { title: '  Updated Friday  ', description: '  A friendly challenge.  ', questionTimeSeconds: 5 })
      assert.equal(response.status, 200)
      const { competition: after } = await response.json()
      assert.equal(after.title, 'Updated Friday')
      assert.equal(after.description, 'A friendly challenge.')
      assert.equal(after.questionTimeSeconds, 5)
      assert.equal(after.createdAt, before.createdAt)
      assert.ok(new Date(after.updatedAt) > new Date(before.updatedAt))
      const { competitions } = await (await send()).json()
      assert.equal(competitions.length, 2)
      assert.equal(competitions[0].id, draftId)
      assert.equal((await send(`/${randomUUID()}`, 'PUT', { title: 'Missing' })).status, 404)
    })

    await context.test('rejects suspended and expired sessions on competition endpoints', async () => {
      await pool!.query("UPDATE users SET status = 'suspended' WHERE id = $1", [owner.id])
      assert.equal((await send()).status, 401)
      assert.equal((await send(`/${draftId}`, 'PUT', { title: 'No access' })).status, 401)
      await pool!.query("UPDATE users SET status = 'active' WHERE id = $1", [owner.id])
      await pool!.query("UPDATE user_sessions SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE user_id = $1", [owner.id])
      assert.equal((await send()).status, 401)
    })
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    await pool?.end()
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`) }
    finally { await admin.end() }
  }
})
