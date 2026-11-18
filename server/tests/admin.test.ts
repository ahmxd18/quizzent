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
import { hostingWeek } from '../src/features/rooms/hosting-policy.js'

test('hosting weeks reset at midnight UTC on Monday', () => {
  const sunday = hostingWeek(new Date('2026-01-04T23:59:59.999Z'))
  assert.equal(sunday.start.toISOString(), '2025-12-29T00:00:00.000Z')
  assert.equal(sunday.end.toISOString(), '2026-01-05T00:00:00.000Z')
  assert.equal(hostingWeek(sunday.end).start.getTime(), sunday.end.getTime())
})

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
      assert.deepEqual(accounts, [{ id: host.id, email: host.email, displayName: host.displayName, status: 'active', role: 'organiser', hostingRestricted: false, weeklyHostingLimit: null }])
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
      assert.equal((await send(`${path}/role`, rootCookie, 'PUT', { role: 'superadmin' })).status, 400)
      assert.equal((await send(`${path}/role`, rootCookie, 'PUT', { role: 'superadmin', password: 'wrong password' })).status, 403)
      assert.equal((await send('/auth/session', targetOrganiserCookie)).status, 200)
      assert.equal((await send(`${path}/role`, rootCookie, 'PUT', { role: 'superadmin', password })).status, 200)
      assert.equal((await send('/admin/overview', targetOrganiserCookie)).status, 401)
      assert.equal(await createSession(database, target.id, undefined, 'organiser'), null)
      targetAdminCookie = await signIn(target.email)
      assert.equal((await send('/admin/overview', targetAdminCookie)).status, 200)
      assert.equal((await send(`/admin/users/${root.id}/role`, rootCookie, 'PUT', { role: 'organiser', password })).status, 409)
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

    await context.test('enforces restrictions and the last weekly slot while preserving organiser access', async () => {
      const { rows: [draft] } = await database.query('SELECT id FROM competitions WHERE organiser_id = $1', [host.id])
      const { start } = hostingWeek(new Date())
      await database.query('UPDATE rooms SET created_at = $2 WHERE organiser_id = $1', [host.id, new Date(start.getTime() - 1)])
      const policyPath = `/admin/users/${host.id}/hosting`
      const setPolicy = (restricted: boolean, weeklyLimit: number | null) => send(policyPath, rootCookie, 'PUT', { restricted, weeklyLimit })
      const open = () => send('/rooms', hostCookie, 'POST', { competitionId: draft.id, admissionMode: 'open' })
      assert.equal((await send(policyPath, hostCookie, 'PUT', { restricted: false, weeklyLimit: null })).status, 403)
      assert.equal((await setPolicy(false, -1)).status, 400)
      assert.equal((await setPolicy(false, 1.5)).status, 400)
      assert.equal((await setPolicy(true, 1)).status, 200)
      assert.equal((await open()).status, 403)
      assert.equal((await send('/auth/session', hostCookie)).status, 200)
      assert.equal((await send('/competitions', hostCookie)).status, 200)
      const history = await (await send('/rooms', hostCookie)).json()
      assert.equal(history.rooms.length, 1)
      assert.equal(history.hosting.used, 0)
      assert.equal((await setPolicy(false, 0)).status, 200)
      assert.equal((await open()).status, 409)
      assert.equal((await setPolicy(false, 1)).status, 200)
      const concurrent = await Promise.all([open(), open()])
      assert.deepEqual(concurrent.map(item => item.status).sort(), [201, 409])
      const { room } = await concurrent.find(item => item.ok)!.json()
      assert.equal((await send(`/rooms/${room.id}/close`, hostCookie, 'POST', {})).status, 200)
      const exhausted = await open()
      assert.equal(exhausted.status, 409)
      assert.deepEqual(await exhausted.json(), { message: 'You have reached your weekly hosting limit.' })
      assert.equal((await setPolicy(false, 2)).status, 200)
      const forCancellation = await open()
      assert.equal(forCancellation.status, 201)
      const { room: cancelled } = await forCancellation.json()
      assert.equal((await send(`/admin/rooms/${cancelled.id}/cancel`, rootCookie, 'POST', { reason: 'Cancelled within the quota week' })).status, 200)
      assert.equal((await open()).status, 409)
      assert.equal((await setPolicy(false, null)).status, 200)
      assert.equal((await open()).status, 201)
      assert.equal((await setPolicy(true, null)).status, 200)
      const restriction = await (await send('/rooms', hostCookie)).json()
      assert.equal(restriction.rooms.filter((entry: { status: string }) => entry.status === 'open').length, 1)
      assert.equal(restriction.hosting.used, 3)
      assert.equal(restriction.hosting.restricted, true)
      assert.equal((await setPolicy(false, null)).status, 200)
    })

    await context.test('lists read-only records with exact owners, status filters, inclusive UTC dates and pagination', async () => {
      const endpoint = '/admin/directory'
      assert.equal((await send(endpoint, hostCookie)).status, 403)
      assert.equal((await send(endpoint, guestCookie)).status, 401)
      const get = async (query = '') => (await send(`${endpoint}${query}`, rootCookie)).json()
      const drafted = await createOrganiser(database, { displayName: 'Draft Owner', email: 'draft-only@example.test', password })
      await createCompetition(database, drafted.id, { title: 'Draft-only Quiz', description: '', questionTimeSeconds: 10 })
      await database.query(
        `UPDATE rooms SET created_at = CASE
          WHEN cancellation_reason IS NOT NULL THEN '2026-01-15T23:59:59.999999Z'::timestamptz
          WHEN status = 'closed' THEN '2026-01-16T00:00:00Z'::timestamptz
          ELSE '2026-01-16T23:59:59.999999Z'::timestamptz END
        WHERE organiser_id = $1`, [host.id],
      )
      const date = '&startDate=2026-01-16&endDate=2026-01-16'
      const { records } = await get('?organiser=HOST%40EXAMPLE.TEST' + date)
      assert.deepEqual(records.map((entry: { status: string }) => entry.status), ['live', 'ended'])
      assert.ok(records.every((entry: { organiserEmail: string }) => entry.organiserEmail === host.email))
      assert.equal((await get('?status=ended' + date)).records.length, 1)
      assert.equal((await get('?status=cancelled&endDate=2026-01-15')).records.length, 2)
      assert.equal((await get('?status=drafted&organiser=draft-only%40example.test')).records[0].kind, 'competition')
      assert.equal((await get('?status=published&organiser=host%40example.test')).records[0].kind, 'competition')
      assert.equal((await get('?organiser=missing%40example.test')).records.length, 0)
      for (const bad of ['?startDate=2026-02-02&endDate=2026-02-01', '?endDate=2026-02-29', '?page=0', '?status=other']) {
        assert.equal((await send(endpoint + bad, rootCookie)).status, 400)
      }
      await database.query(
        "INSERT INTO competitions (organiser_id, title) SELECT $1, 'Draft ' || number FROM generate_series(1, 27) number",
        [drafted.id],
      )
      const first = await get('?status=drafted&page=1')
      const second = await get('?status=drafted&page=2')
      assert.equal(first.records.length, 25)
      assert.equal(first.hasNextPage, true)
      assert.equal(second.records.length, 3)
      assert.equal(second.hasNextPage, false)
      assert.equal(new Set([...first.records, ...second.records].map(entry => entry.id)).size, 28)
    })

    await context.test('rechecks queued admin writes when two superadmins try to demote each other', async () => {
      const responses = await Promise.all([
        send(`/admin/users/${target.id}/role`, rootCookie, 'PUT', { role: 'organiser', password }),
        send(`/admin/users/${root.id}/role`, targetAdminCookie, 'PUT', { role: 'organiser', password }),
      ])
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 401])
      assert.equal((await database.query("SELECT id FROM users WHERE role = 'superadmin' AND status = 'active'")).rowCount, 1)
    })
    await context.test('rate limits password verification across sessions and targets of the same admin', async () => {
      const { rows: [active] } = await database.query<{ id: string }>("SELECT id FROM users WHERE role = 'superadmin' AND status = 'active'")
      const [sessionOne, sessionTwo] = await Promise.all([cookieFor(active.id), cookieFor(active.id)])
      const attempt = (id: string, cookie: string, secret: string) => send(`/admin/users/${id}/role`, cookie, 'PUT', { role: 'superadmin', password: secret })
      let limited = false
      for (let index = 0; index <= 5; index++) {
        const response = await attempt(host.id, sessionOne, 'incorrect')
        if (response.status === 429) { limited = true; break }
        assert.equal(response.status, 403)
      }
      assert.equal(limited, true)
      const response = await attempt(active.id === root.id ? target.id : root.id, sessionTwo, password)
      assert.equal(response.status, 429)
      assert.ok(response.headers.has('Retry-After'))
      assert.equal((await send('/admin/overview', sessionTwo)).status, 200)
    })
  } finally {
    await runtime?.close()
    await pool?.end()
    try { await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`) }
    finally { await db.end() }
  }
})
