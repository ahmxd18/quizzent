import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { runner } from 'node-pg-migrate'
import { Client, Pool } from 'pg'
import { io, type Socket } from 'socket.io-client'
import { setTimeout as delay } from 'node:timers/promises'
import { createQuizzentServer } from '../src/server.js'
import { createOrganiser } from '../src/features/auth/signup.service.js'
import { createSession } from '../src/features/auth/session.service.js'
import { createCompetition } from '../src/features/competitions/competition.service.js'
import { publishCompetition } from '../src/features/competitions/publication.service.js'
import { saveQuestion } from '../src/features/questions/question.service.js'
import { createGuestSession } from '../src/features/rooms/guest-session.service.js'
import { hashSecret } from '../src/lib/secrets.js'
import { joinRoom } from '../src/features/rooms/admission.service.js'

type Snapshot = { onlineCount: number; readyCount: number; ready?: boolean; participants?: { participantId: string; ready: boolean }[] }

async function lobbySnapshot(event: Promise<Snapshot & { serverNow?: number }>) {
  const { serverNow, ...snapshot } = await event
  assert.equal(typeof serverNow, 'number')
  return snapshot
}

function waitFor<T>(socket: Socket, event: string, matches: (value: T) => boolean = () => true) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, receive)
      reject(new Error(`Timed out waiting for ${event}`))
    }, 2_000)
    function receive(value: T) {
      if (!matches(value)) return
      clearTimeout(timeout)
      socket.off(event, receive)
      resolve(value)
    }
    socket.on(event, receive)
  })
}

test('rooms and guest admission', async context => {
  assert.ok(process.env.DATABASE_URL)
  const schema = `quizzent_rooms_test_${randomUUID().replaceAll('-', '')}`
  const admin = new Client({ connectionString: process.env.DATABASE_URL })
  await admin.connect()
  let pool: Pool | undefined
  let created = false
  let runtime: ReturnType<typeof createQuizzentServer> | undefined
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    created = true
    await runner({ dbClient: admin, dir: resolve('server/migrations'), migrationsTable: 'pgmigrations', migrationsSchema: schema, schema, direction: 'up', log: () => {}, verbose: false })
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 5 })
    const owner = await createOrganiser(pool, { displayName: 'Room Owner', email: 'rooms@example.test', password: 'long room test passphrase' })
    const other = await createOrganiser(pool, { displayName: 'Other Owner', email: 'other@example.test', password: 'another room test passphrase' })
    const draft = await createCompetition(pool, owner.id, { title: 'Room Test', description: '', questionTimeSeconds: 10 })
    await saveQuestion(pool, owner.id, draft.id, { prompt: 'Pick A', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 })
    await publishCompetition(pool, owner.id, draft.id)
    const unpublished = await createCompetition(pool, owner.id, { title: 'Not ready', description: '', questionTimeSeconds: 10 })
    const ownerCookie = `quizzent_session=${await createSession(pool, owner.id)}`
    const otherCookie = `quizzent_session=${await createSession(pool, other.id)}`
    const reconnectGrace = 500
    const warningMs = 750
    runtime = createQuizzentServer(pool, reconnectGrace, warningMs)
    const server = runtime.server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const base = `${origin}/api`
    const send = (path: string, method = 'GET', body?: unknown, cookie = ownerCookie) => fetch(`${base}${path}`, {
      method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Quizzent-Request': '1' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    async function guest() {
      const response = await send('/guest/session', 'POST', {}, '')
      assert.equal(response.status, 200)
      return response.headers.get('set-cookie')!.split(';')[0]
    }
    async function invite(roomId: string, reference: string) {
      const response = await send(`/rooms/${roomId}/invitations`, 'POST', { reference })
      assert.equal(response.status, 201)
      return response.json() as Promise<{ invitation: { id: string; reference: string }; token: string }>
    }
    let room: { id: string; code: string }
    let johnCookie: string
    let privateRoom: { id: string; code: string }
    let privateInvitation: Awaited<ReturnType<typeof invite>>

    await context.test('requires organiser authentication, publication, and strict fields', async () => {
      assert.equal((await send('/rooms', 'GET', undefined, '')).status, 401)
      assert.equal((await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open' }, '')).status, 401)
      assert.equal((await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open' }, otherCookie)).status, 404)
      assert.equal((await send('/rooms', 'POST', { competitionId: unpublished.id, admissionMode: 'open' })).status, 409)
      assert.equal((await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open', lobbySeconds: -1 })).status, 400)
      assert.equal((await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open', minReady: 51 })).status, 400)
      assert.equal((await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open', organiserId: other.id })).status, 400)
      assert.equal((await fetch(`${base}/rooms`, { method: 'POST', headers: { Cookie: ownerCookie } })).status, 403)
    })
    await context.test('allows only one open room even under simultaneous hosting requests', async () => {
      const responses = await Promise.all([send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open' }), send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open' })])
      assert.deepEqual(responses.map(response => response.status).sort(), [201, 409])
      room = (await responses.find(response => response.status === 201)!.json()).room
      assert.match(room.code, /^[A-HJ-NP-Z2-9]{8}$/)
      assert.equal((await send(`/rooms/${room.id}`, 'GET', undefined, otherCookie)).status, 404)
      assert.equal((await send(`/rooms/${room.id}/close`, 'POST', {}, otherCookie)).status, 404)
      assert.equal((await send('/rooms/bad-id')).status, 400)
    })
    await context.test('bootstraps an HttpOnly guest cookie without granting organiser access', async () => {
      const response = await send('/guest/session', 'POST', {}, '')
      assert.match(response.headers.get('set-cookie')!, /HttpOnly/)
      assert.match(response.headers.get('set-cookie')!, /SameSite=Lax/)
      johnCookie = response.headers.get('set-cookie')!.split(';')[0]
      assert.equal((await send('/guest/session', 'POST', {}, johnCookie)).headers.get('set-cookie'), null)
      assert.equal((await send(`/rooms/${room.id}`, 'GET', undefined, johnCookie)).status, 401)
      assert.equal((await send(`/guest/rooms/${room.id}`, 'GET', undefined, '')).status, 401)
      const preview = await send(`/room-entry/${room.code.toLowerCase()}`, 'GET', undefined, '')
      assert.equal(preview.status, 200)
      assert.equal(preview.headers.get('cache-control'), 'no-store')
      const content = await preview.json()
      assert.match(content.suggestedNickname, /^[A-Za-z]+ [A-Za-z]+$/)
      assert.equal(content.participants, undefined)
      assert.equal(content.invitations, undefined)
      assert.equal(content.questions, undefined)
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'John' }, '')).status, 401)
    })
    await context.test('settles case-insensitive nickname races and restores the same membership', async () => {
      const otherGuest = await guest()
      const responses = await Promise.all([
        send(`/room-entry/${room.code}/join`, 'POST', { nickname: ' John ' }, johnCookie),
        send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'JOHN' }, otherGuest),
      ])
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
      if (responses[0].status !== 200) johnCookie = otherGuest
      const first = await (await send(`/guest/rooms/${room.id}`, 'GET', undefined, johnCookie)).json()
      const returning = await (await send(`/room-entry/${room.code}`, 'GET', undefined, johnCookie)).json()
      assert.equal(returning.participantId, first.participant.id)
      assert.equal(returning.suggestedNickname, first.participant.nickname)
      const again = await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'A new nickname' }, johnCookie)
      assert.equal((await again.json()).participantId, first.participant.id)
      assert.equal((await (await send(`/guest/rooms/${room.id}`, 'GET', undefined, johnCookie)).json()).participant.nickname, first.participant.nickname)
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'JoHn' }, await guest())).status, 409)
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'Nick  Name' }, await guest())).status, 200)
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'nick name' }, await guest())).status, 409)
      const { rows: [count] } = await pool!.query('SELECT count(*)::integer AS total FROM room_participants WHERE room_id = $1', [room.id])
      assert.equal(count.total, 2)
    })
    await context.test('personal invitations bind organiser references, not the chosen nickname', async () => {
      const invitation = await invite(room.id, 'John · Student 1042')
      assert.equal((await send(`/rooms/${room.id}/invitations`, 'POST', { reference: 'john · student 1042' })).status, 409)
      const { rows: [stored] } = await pool!.query('SELECT token_hash FROM room_invitations WHERE id = $1', [invitation.invitation.id])
      assert.equal(stored.token_hash, hashSecret(invitation.token))
      assert.notEqual(stored.token_hash, invitation.token)
      const cookie = await guest()
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'ThunderGuy', invitationToken: invitation.token, organiserReference: 'Mike' }, cookie)).status, 400)
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'ThunderGuy', invitationToken: invitation.token }, cookie)).status, 200)
      const details = await (await send(`/rooms/${room.id}`)).json()
      assert.equal(details.participants.find((participant: { nickname: string }) => participant.nickname === 'ThunderGuy').organiserReference, 'John · Student 1042')
      assert.equal(details.participants.find((participant: { organiserReference: string | null }) => participant.organiserReference === null).organiserReference, null)
      const publicData = await (await send(`/guest/rooms/${room.id}`, 'GET', undefined, cookie)).json()
      assert.equal(publicData.participant.organiserReference, undefined)
      assert.equal(publicData.invitations, undefined)
      assert.equal((await send(`/rooms/${room.id}/invitations/${invitation.invitation.id}/link`, 'POST', {})).status, 409)
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'Impostor', invitationToken: invitation.token }, await guest())).status, 409)
    })
    await context.test('rotates unused links and settles simultaneous invitation claims with one participant', async () => {
      const invitation = await invite(room.id, 'Mike · Student 1046')
      const renewed = await (await send(`/rooms/${room.id}/invitations/${invitation.invitation.id}/link`, 'POST', {})).json()
      assert.notEqual(renewed.token, invitation.token)
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'OldLink', invitationToken: invitation.token }, await guest())).status, 403)
      const firstGuest = await guest()
      const secondGuest = await guest()
      const responses = await Promise.all([
        send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'Moonlight', invitationToken: renewed.token }, firstGuest),
        send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'PinkyPunk', invitationToken: renewed.token }, secondGuest),
      ])
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
    })
    await context.test('database uniqueness also rejects direct duplicate guest and nickname writes', async () => {
      const { rows: [participant] } = await pool!.query('SELECT * FROM room_participants WHERE room_id = $1 LIMIT 1', [room.id])
      const fresh = await createGuestSession(pool!)
      await assert.rejects(pool!.query('INSERT INTO room_participants (room_id, guest_id, participant_number, nickname) VALUES ($1, $2, 40, $3)', [room.id, fresh.guestId, participant.nickname.toUpperCase()]), { code: '23505' })
      await assert.rejects(pool!.query('INSERT INTO room_participants (room_id, guest_id, participant_number, nickname) VALUES ($1, $2, 40, $3)', [room.id, participant.guest_id, 'Duplicate Guest']), { code: '23505' })
    })
    await context.test('caps the room at 50 when the final two guests join concurrently', async () => {
      const { rows: [count] } = await pool!.query('SELECT count(*)::integer AS total FROM room_participants WHERE room_id = $1', [room.id])
      for (let index = count.total; index < 49; index++) {
        const session = await createGuestSession(pool!)
        await joinRoom(pool!, room.code, session.guestId, `Capacity Guest ${index}`)
      }
      const firstGuest = await guest()
      const secondGuest = await guest()
      const responses = await Promise.all([
        send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'Last Slot One' }, firstGuest),
        send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'Last Slot Two' }, secondGuest),
      ])
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
      const { rows: [after] } = await pool!.query('SELECT count(*)::integer AS total FROM room_participants WHERE room_id = $1', [room.id])
      assert.equal(after.total, 50)
      const fresh = await createGuestSession(pool!)
      await assert.rejects(pool!.query('INSERT INTO room_participants (room_id, guest_id, participant_number, nickname) VALUES ($1, $2, 51, $3)', [room.id, fresh.guestId, 'Overflow']), { code: '23514' })
    })
    await context.test('closing preserves records, prevents admission, and frees the organiser to host again', async () => {
      assert.equal((await send(`/rooms/${room.id}/close`, 'POST', {})).status, 200)
      assert.equal((await send(`/room-entry/${room.code}/join`, 'POST', { nickname: 'Too Late' }, await guest())).status, 409)
      const own = await (await send(`/guest/rooms/${room.id}`, 'GET', undefined, johnCookie)).json()
      assert.equal(own.room.status, 'closed')
      assert.equal(own.room.participantCount, 50)
      const response = await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'invitation' })
      assert.equal(response.status, 201)
      privateRoom = (await response.json()).room
      assert.notEqual(privateRoom.code, room.code)
      assert.equal((await (await send('/rooms')).json()).rooms.length, 2)
    })
    await context.test('invitation-only rooms reject code-only joins and keep identity after cookie expiry', async () => {
      privateInvitation = await invite(privateRoom.id, 'Alice · A1043')
      assert.equal((await send(`/room-entry/${privateRoom.code}/join`, 'POST', { nickname: 'Alice' }, johnCookie)).status, 403)
      assert.equal((await send(`/room-entry/${privateRoom.code}/join`, 'POST', { nickname: 'Alice', invitationToken: 'a'.repeat(64) }, johnCookie)).status, 403)
      assert.equal((await send(`/room-entry/${privateRoom.code}/join`, 'POST', { nickname: 'John', invitationToken: privateInvitation.token }, johnCookie)).status, 200)
      const token = johnCookie.split('=')[1]
      await pool!.query("UPDATE guest_sessions SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE token_hash = $1", [hashSecret(token)])
      assert.equal((await send(`/guest/rooms/${privateRoom.id}`, 'GET', undefined, johnCookie)).status, 401)
      const replacement = await guest()
      assert.equal((await send(`/room-entry/${privateRoom.code}/join`, 'POST', { nickname: 'John Again', invitationToken: privateInvitation.token }, replacement)).status, 409)
      const details = await (await send(`/rooms/${privateRoom.id}`)).json()
      assert.equal(details.participants[0].organiserReference, 'Alice · A1043')
      assert.equal(details.participants[0].nickname, 'John')
    })
    await context.test('serialises closing against a personal invitation join', async () => {
      const invitation = await invite(privateRoom.id, 'Carol · C1044')
      const cookie = await guest()
      const [closing, joining] = await Promise.all([
        send(`/rooms/${privateRoom.id}/close`, 'POST', {}),
        send(`/room-entry/${privateRoom.code}/join`, 'POST', { nickname: 'Carol', invitationToken: invitation.token }, cookie),
      ])
      assert.equal(closing.status, 200)
      assert.ok([200, 409].includes(joining.status))
      const details = await (await send(`/rooms/${privateRoom.id}`)).json()
      assert.equal(details.room.status, 'closed')
      assert.equal(details.participants.length, joining.status === 200 ? 2 : 1)
      assert.equal((await send(`/room-entry/${privateRoom.code}/join`, 'POST', { nickname: 'Late Carol', invitationToken: invitation.token }, await guest())).status, 409)
    })
    await context.test('validates public input and sets Secure host cookies in production', async () => {
      assert.equal((await send('/room-entry/bad', 'GET', undefined, '')).status, 400)
      assert.equal((await send('/room-entry/ZZZZZZZZ', 'GET', undefined, '')).status, 404)
      assert.equal((await send(`/room-entry/${privateRoom.code}/join`, 'POST', { nickname: ' ' }, await guest())).status, 400)
      assert.equal((await send(`/room-entry/${privateRoom.code}/join`, 'POST', { nickname: 'Name\u0000' }, await guest())).status, 400)
      assert.equal((await send(`/rooms/${privateRoom.id}/invitations`, 'POST', { reference: 'x'.repeat(9000) })).status, 413)
      const previous = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      try {
        const response = await send('/guest/session', 'POST', {}, '')
        const cookie = response.headers.get('set-cookie')!
        assert.match(cookie, /^__Host-quizzent_guest=/)
        assert.match(cookie, /; Secure/)
        assert.doesNotMatch(cookie, /Domain=/)
      } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous }
    })
    await context.test('authorises live lobby members and counts readiness once across tabs and reconnects', async () => {
      const response = await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open' })
      assert.equal(response.status, 201)
      const { room: liveRoom } = await response.json()
      const guestCookie = await guest()
      const sockets: Socket[] = []
      function openSocket(role: 'organiser' | 'guest', cookie: string, socketOrigin = origin) {
        const socket = io(origin, {
          auth: { role, roomId: liveRoom.id },
          extraHeaders: { Cookie: cookie, Origin: socketOrigin },
          transports: ['websocket'],
          autoConnect: false,
          reconnection: false,
        })
        sockets.push(socket)
        return socket
      }
      try {
        for (const socket of [
          openSocket('organiser', otherCookie),
          openSocket('guest', guestCookie),
          openSocket('organiser', ownerCookie, 'http://different-site.test'),
        ]) {
          const denied = waitFor<Error>(socket, 'connect_error')
          socket.connect()
          await denied
          assert.equal(socket.connected, false)
        }

        const host = openSocket('organiser', ownerCookie)
        const hostInitial = waitFor<Snapshot>(host, 'lobby:state')
        host.connect()
        assert.deepEqual(await lobbySnapshot(hostInitial), { onlineCount: 0, readyCount: 0, participants: [] })
        assert.equal((await host.timeout(2_000).emitWithAck('lobby:ready', true)).ok, false)

        const joined = waitFor(host, 'lobby:room-changed')
        const admission = await send(`/room-entry/${liveRoom.code}/join`, 'POST', { nickname: 'Ready Otter' }, guestCookie)
        assert.equal(admission.status, 200)
        const { participantId } = await admission.json()
        await joined

        const first = openSocket('guest', guestCookie)
        const initial = waitFor<Snapshot>(first, 'lobby:state')
        first.connect()
        assert.deepEqual(await lobbySnapshot(initial), { onlineCount: 1, readyCount: 0, ready: false })
        const ready = waitFor<Snapshot>(host, 'lobby:state', state => state.readyCount === 1)
        assert.equal((await first.timeout(2_000).emitWithAck('lobby:ready', true)).ok, true)
        assert.deepEqual(await lobbySnapshot(ready), { onlineCount: 1, readyCount: 1, participants: [{ participantId, ready: true }] })

        const second = openSocket('guest', guestCookie)
        const secondInitial = waitFor<Snapshot>(second, 'lobby:state')
        second.connect()
        assert.deepEqual(await lobbySnapshot(secondInitial), { onlineCount: 1, readyCount: 1, ready: true })
        const stillReady = waitFor<Snapshot>(host, 'lobby:state', state => state.readyCount === 1)
        first.disconnect()
        assert.equal((await stillReady).onlineCount, 1)
        assert.equal((await second.timeout(2_000).emitWithAck('lobby:ready', 'true')).ok, false)

        const offline = waitFor<Snapshot>(host, 'lobby:state', state => state.onlineCount === 0)
        second.disconnect()
        assert.equal((await offline).readyCount, 0)
        const restored = waitFor<Snapshot>(first, 'lobby:state')
        first.connect()
        assert.equal((await restored).ready, true)

        const offlineAgain = waitFor<Snapshot>(host, 'lobby:state', state => state.onlineCount === 0)
        first.disconnect()
        await offlineAgain
        await delay(reconnectGrace + 50)
        const reset = waitFor<Snapshot>(second, 'lobby:state')
        second.connect()
        assert.deepEqual(await lobbySnapshot(reset), { onlineCount: 1, readyCount: 0, ready: false })
        const readyAgain = waitFor<Snapshot>(host, 'lobby:state', state => state.readyCount === 1)
        assert.equal((await second.timeout(2_000).emitWithAck('lobby:ready', true)).ok, true)
        await readyAgain
        const unready = waitFor<Snapshot>(first, 'lobby:state')
        first.connect()
        assert.equal((await unready).ready, true)
        const updated = waitFor<Snapshot>(first, 'lobby:state', state => state.ready === false)
        assert.equal((await second.timeout(2_000).emitWithAck('lobby:ready', false)).ok, true)
        assert.equal((await updated).readyCount, 0)

        const closed = waitFor(first, 'lobby:room-changed')
        assert.equal((await send(`/rooms/${liveRoom.id}/close`, 'POST', {})).status, 200)
        await closed
        assert.equal((await first.timeout(2_000).emitWithAck('lobby:ready', true)).ok, false)
        const history = await send(`/guest/rooms/${liveRoom.id}`, 'GET', undefined, guestCookie)
        assert.equal((await history.json()).room.status, 'closed')
      } finally {
        for (const socket of sockets) socket.disconnect()
      }
    })
    await context.test('starts once, restarts an interrupted warning, and locks only live ready guests into the roster', async () => {
      const opened = await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open', lobbySeconds: 2, minReady: 2 })
      assert.equal(opened.status, 201)
      const { room: live } = await opened.json()
      const sockets: Socket[] = []

      async function connect(role: 'organiser' | 'guest', cookie: string) {
        const socket = io(origin, {
          auth: { role, roomId: live.id }, extraHeaders: { Cookie: cookie, Origin: origin },
          transports: ['websocket'], autoConnect: false, reconnection: false,
        })
        sockets.push(socket)
        const connected = waitFor(socket, 'lobby:state')
        socket.connect()
        await connected
        return socket
      }
      async function join(nickname: string) {
        const cookie = await guest()
        const response = await send(`/room-entry/${live.code}/join`, 'POST', { nickname }, cookie)
        assert.equal(response.status, 200)
        return { cookie, ...(await response.json() as { participantId: string }) }
      }
      async function read() {
        const response = await send(`/rooms/${live.id}`)
        assert.equal(response.status, 200)
        return response.json() as Promise<{
          room: { lobbyEndsAt: string; warningEndsAt: string | null; startedAt: string | null }
          participants: { id: string; admitted: boolean }[]
        }>
      }
      async function until(predicate: (details: Awaited<ReturnType<typeof read>>) => boolean) {
        const timeout = Date.now() + 5_000
        do {
          const current = await read()
          if (predicate(current)) return current
          await delay(25)
        } while (Date.now() < timeout)
        assert.fail('Timed out waiting for a room start transition.')
      }

      try {
        const host = await connect('organiser', ownerCookie)
        const [one, two, observer] = await Promise.all([join('Ready One'), join('Ready Two'), join('Observer')])
        const [first, second] = await Promise.all([connect('guest', one.cookie), connect('guest', two.cookie), connect('guest', observer.cookie)])
        const results = await Promise.all([first, second].map(socket => socket.timeout(2_000).emitWithAck('lobby:ready', true)))
        assert.ok(results.every(result => result.ok))
        const before = (await read()).room
        assert.ok(Date.now() < Date.parse(before.lobbyEndsAt))
        assert.equal(before.warningEndsAt, null)
        assert.equal(before.startedAt, null)

        // Hold the same lock as room admission while the ready count dips and recovers.
        const initial = (await until(details => !!details.room.warningEndsAt)).room
        const originalEnd = Date.parse(initial.warningEndsAt!)
        assert.ok(originalEnd - warningMs >= Date.parse(initial.lobbyEndsAt))
        const client = await pool!.connect()
        try {
          await client.query('BEGIN')
          await client.query('SELECT id FROM rooms WHERE id = $1 FOR UPDATE', [live.id])
          const dropped = waitFor<Snapshot>(host, 'lobby:state', state => state.readyCount === 1)
          second.disconnect()
          await dropped
          const recovered = waitFor<Snapshot>(host, 'lobby:state', state => state.readyCount === 2)
          second.connect()
          await recovered
          await delay(Math.max(0, originalEnd - Date.now()) + 20)
          const blocked = (await read()).room
          assert.equal(blocked.startedAt, null)
        } finally {
          await client.query('ROLLBACK')
          client.release()
        }

        const restarted = (await until(details => !!details.room.warningEndsAt && Date.parse(details.room.warningEndsAt) > originalEnd)).room
        assert.ok(Date.parse(restarted.warningEndsAt!) - warningMs > originalEnd)
        const final = await until(details => !!details.room.startedAt)
        assert.equal(final.room.warningEndsAt, null)
        assert.ok(Date.parse(final.room.startedAt!) >= Date.parse(restarted.warningEndsAt!))
        assert.deepEqual(new Set(final.participants.filter(p => p.admitted).map(p => p.id)), new Set([one.participantId, two.participantId]))

        assert.equal((await send(`/room-entry/${live.code}/join`, 'POST', { nickname: 'Late Guest' }, await guest())).status, 409)
        assert.equal((await send(`/rooms/${live.id}/invitations`, 'POST', { reference: 'Too Late' })).status, 409)
        assert.equal((await first.timeout(2_000).emitWithAck('lobby:ready', false)).ok, false)
        assert.equal((await read()).room.startedAt, final.room.startedAt)
        const ownStatus = async (cookie: string) => (await (await send(`/guest/rooms/${live.id}`, 'GET', undefined, cookie)).json()).participant.admitted
        assert.equal(await ownStatus(one.cookie), true)
        assert.equal(await ownStatus(observer.cookie), false)
        assert.equal((await send(`/rooms/${live.id}/close`, 'POST', {})).status, 200)
        assert.equal((await read()).room.startedAt, final.room.startedAt)
      } finally {
        for (const socket of sockets) socket.disconnect()
      }
    })
  } finally {
    await runtime?.close()
    await pool?.end()
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`) }
    finally { await admin.end() }
  }
})
