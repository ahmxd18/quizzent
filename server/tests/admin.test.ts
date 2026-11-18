import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { runner } from 'node-pg-migrate'
import { Client, Pool } from 'pg'
import { createQuizzentServer } from '../src/server.js'
import { bootstrapSuperadmin } from '../src/features/admin/admin.service.js'
import { createOrganiser } from '../src/features/auth/signup.service.js'
import { createSession } from '../src/features/auth/session.service.js'
import { createCompetition } from '../src/features/competitions/competition.service.js'
import { saveQuestion } from '../src/features/questions/question.service.js'
import { publishCompetition } from '../src/features/competitions/publication.service.js'
import { createRoom } from '../src/features/rooms/room.service.js'
import { createGuestSession } from '../src/features/rooms/guest-session.service.js'

test('superadmin controls', async context => {
  assert.ok(process.env.DATABASE_URL)
  const schema = `quizzent_admin_${randomUUID().replaceAll('-', '')}`
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  let pool: Pool | undefined
  let runtime: ReturnType<typeof createQuizzentServer> | undefined
  try {
    await db.query(`CREATE SCHEMA "${schema}"`)
    await runner({ dbClient: db, dir: resolve('server/migrations'), migrationsTable: 'pgmigrations', migrationsSchema: schema, schema, direction: 'up', log: () => {}, verbose: false })
    const database = pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 5 })
    const password = 'admin test passphrase'
    const root = await createOrganiser(database, { displayName: 'First Admin', email: 'root@example.test', password })
    const target = await createOrganiser(database, { displayName: 'Second Admin', email: 'target@example.test', password })
    const host = await createOrganiser(database, { displayName: 'Room Host', email: 'host@example.test', password })
    const cookieFor = async (id: string) => `quizzent_session=${await createSession(database, id)}`
    const rootBefore = await cookieFor(root.id)
    const hostCookie = await cookieFor(host.id)
    const guestCookie = `quizzent_guest=${(await createGuestSession(database)).token}`
    runtime = createQuizzentServer(database)
    await runtime.start(0)
    const origin = `http://127.0.0.1:${(runtime.server.address() as AddressInfo).port}/api`

    function send(path: string, cookie = '', method = 'GET', input?: unknown, crossSite = false) {
      return fetch(origin + path, {
        method, headers: {
          Cookie: cookie, 'Content-Type': 'application/json', 'X-Quizzent-Request': '1',
          ...(crossSite ? { 'Sec-Fetch-Site': 'cross-site' } : {}),
        },
        body: input === undefined ? undefined : JSON.stringify(input),
      })
    }
    async function signIn(email: string) {
      const response = await send('/auth/login', '', 'POST', { email, password })
      assert.equal(response.status, 200)
      return response.headers.get('Set-Cookie')!.split(';')[0]
    }

    await context.test('provisions once outside public signup, and denies organiser and guest access', async () => {
      assert.equal((await send('/admin/overview')).status, 401)
      assert.equal((await send('/admin/overview', guestCookie)).status, 401)
      assert.equal((await send('/admin/overview', hostCookie)).status, 403)
      assert.equal((await send(`/admin/users/${host.id}/role`, hostCookie, 'PUT', { role: 'superadmin' })).status, 403)
      const signup = await send('/auth/signup', '', 'POST', { email: 'new@example.test', password, displayName: 'New', role: 'superadmin' })
      assert.equal(signup.status, 400)
      await assert.rejects(bootstrapSuperadmin(database, 'missing@example.test'), { status: 404 })
      assert.equal(await bootstrapSuperadmin(database, ' ROOT@EXAMPLE.TEST '), root.email)
      assert.equal((await send('/auth/session', rootBefore)).status, 401)
      await assert.rejects(bootstrapSuperadmin(database, target.email), { status: 409 })
    })

    const rootCookie = await signIn(root.email)
    let targetAdminCookie = ''
    await context.test('lists safe account fields and revokes all sessions on status and role changes', async () => {
      const overview = await send('/admin/overview?q=ROOM%20HOST', rootCookie)
      assert.equal(overview.status, 200)
      assert.equal(overview.headers.get('Cache-Control'), 'no-store')
      const { accounts } = await overview.json()
      assert.deepEqual(accounts, [{ id: host.id, email: host.email, displayName: host.displayName, status: 'active', role: 'organiser' }])
      const path = `/admin/users/${target.id}`
      const [oldA, oldB] = await Promise.all([cookieFor(target.id), cookieFor(target.id)])
      assert.equal((await send(`${path}/status`, rootCookie, 'PUT', { status: 'suspended' }, true)).status, 403)
      assert.equal((await send(`${path}/status`, rootCookie, 'PUT', { status: 'suspended', role: 'superadmin' })).status, 400)
      assert.equal((await send(`${path}/status`, rootCookie, 'PUT', { status: 'suspended' })).status, 200)
      assert.equal((await send('/auth/session', oldA)).status, 401)
      assert.equal((await send('/auth/session', oldB)).status, 401)
      assert.equal(await createSession(database, target.id), null)
      assert.equal((await send('/auth/login', '', 'POST', { email: target.email, password })).status, 401)
      assert.equal((await send(`${path}/status`, rootCookie, 'PUT', { status: 'active' })).status, 200)
      assert.equal((await send('/auth/session', oldA)).status, 401)
      const targetOrganiserCookie = await signIn(target.email)
      assert.equal((await send(`${path}/role`, rootCookie, 'PUT', { role: 'superadmin' })).status, 200)
      assert.equal((await send('/admin/overview', targetOrganiserCookie)).status, 401)
      assert.equal(await createSession(database, target.id, undefined, 'organiser'), null)
      targetAdminCookie = await signIn(target.email)
      assert.equal((await send('/admin/overview', targetAdminCookie)).status, 200)
      assert.equal((await send(`/admin/users/${root.id}/role`, rootCookie, 'PUT', { role: 'organiser' })).status, 409)
      assert.equal((await send(`/admin/users/${root.id}/status`, rootCookie, 'PUT', { status: 'suspended' })).status, 409)
    })

    await context.test('cancels across organisers and records changes in the audit', async () => {
      const competition = await createCompetition(database, host.id, { title: 'Other Host Quiz', description: '', questionTimeSeconds: 10 })
      await saveQuestion(database, host.id, competition.id, { prompt: 'Pick A', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 })
      await publishCompetition(database, host.id, competition.id)
      const room = await createRoom(database, host.id, competition.id, 'open')
      assert.equal((await send(`/room-entry/${room.code}/join`, guestCookie, 'POST', { nickname: 'Guest Otter' })).status, 200)
      const path = `/admin/rooms/${room.id}/cancel`
      assert.equal((await send(path, hostCookie, 'POST', { reason: 'Unauthorised' })).status, 403)
      assert.equal((await send(path, rootCookie, 'POST', { reason: '   ' })).status, 400)
      const { rooms } = await (await send(`/admin/overview?q=${room.code.toLowerCase()}`, rootCookie)).json()
      assert.equal(rooms[0].organiserEmail, host.email)
      assert.equal((await send(path, rootCookie, 'POST', { reason: 'Schedule change' })).status, 200)
      assert.equal((await send(path, rootCookie, 'POST', { reason: 'Again' })).status, 409)
      const guest = await (await send(`/guest/rooms/${room.id}`, guestCookie)).json()
      assert.equal(guest.room.cancellationReason, 'superadmin')
      assert.equal(guest.room.cancellationNote, 'Schedule change')
      assert.equal(guest.room.resultsPublishedAt, null)

      const { actions } = await (await send('/admin/overview', rootCookie)).json()
      assert.deepEqual(actions.map((entry: { action: string }) => entry.action),
        ['room_cancelled', 'role_changed', 'status_changed', 'status_changed', 'bootstrap'])
      assert.equal(actions[0].actorLabel, root.email)
      assert.equal(actions[0].detail, 'Schedule change')
      assert.equal(actions[4].actorLabel, 'Local bootstrap')
    })

    await context.test('rechecks queued admin writes when two superadmins try to demote each other', async () => {
      const responses = await Promise.all([
        send(`/admin/users/${target.id}/role`, rootCookie, 'PUT', { role: 'organiser' }),
        send(`/admin/users/${root.id}/role`, targetAdminCookie, 'PUT', { role: 'organiser' }),
      ])
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 401])
      assert.equal((await database.query("SELECT id FROM users WHERE role = 'superadmin' AND status = 'active'")).rowCount, 1)
    })
  } finally {
    await runtime?.close()
    await pool?.end()
    try { await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`) }
    finally { await db.end() }
  }
})
