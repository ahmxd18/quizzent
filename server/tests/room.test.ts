import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
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
import { missedQuestionCount } from '../src/features/attempts/attempt-clock.js'

test('the exact deadline expires the question and later windows keep their original boundaries', () => {
  const deadline = new Date(10_000)
  assert.equal(missedQuestionCount(deadline, new Date(9_999), 10_000, 3), 0)
  assert.equal(missedQuestionCount(deadline, deadline, 10_000, 3), 1)
  assert.equal(missedQuestionCount(deadline, new Date(19_999), 10_000, 3), 1)
  assert.equal(missedQuestionCount(deadline, new Date(20_000), 10_000, 3), 2)
  assert.equal(missedQuestionCount(deadline, new Date(100_000), 10_000, 3), 3)
})

function savedView<T extends { serverNow?: string }>(view: T) {
  const { serverNow, ...saved } = view
  if (serverNow) assert.ok(Number.isFinite(Date.parse(serverNow)))
  return saved
}

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
    await saveQuestion(pool, owner.id, draft.id, { prompt: 'Pick E', options: ['E', 'F', 'G', 'H'], correctOptionIndex: 0 })
    await saveQuestion(pool, owner.id, draft.id, { prompt: 'Pick I', options: ['I', 'J', 'K', 'L'], correctOptionIndex: 0 })
    await publishCompetition(pool, owner.id, draft.id)
    const unpublished = await createCompetition(pool, owner.id, { title: 'Not ready', description: '', questionTimeSeconds: 10 })
    const ownerCookie = `quizzent_session=${await createSession(pool, owner.id)}`
    const otherCookie = `quizzent_session=${await createSession(pool, other.id)}`
    const reconnectGrace = 500
    const warningMs = 750
    runtime = createQuizzentServer(pool, reconnectGrace, warningMs)
    assert.equal(await runtime.start(0), 0)
    const port = (runtime.server.address() as AddressInfo).port
    const origin = `http://127.0.0.1:${port}`
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

        // Switching tabs must not reset the same participant's readiness budget.
        let blocked = false
        for (let index = 0; index < 21; index++) {
          const result = await second.timeout(2_000).emitWithAck('lobby:ready', false)
          if (!result.ok) {
            assert.match(result.message, /Too many readiness changes/)
            blocked = true
            break
          }
        }
        assert.equal(blocked, true)
        assert.match((await first.timeout(2_000).emitWithAck('lobby:ready', true)).message, /Too many readiness changes/)

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
    await context.test('starts once, restarts an interrupted warning, and locks only live ready guests into the roster', async startTest => {
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
          room: { lobbyEndsAt: string; warningEndsAt: string | null; startedAt: string | null; resultsPublishedAt: string | null; status: string }
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
        const attemptPath = `/guest/rooms/${live.id}/attempt`
        const resultsPath = `/guest/rooms/${live.id}/results`
        const progressPath = `/rooms/${live.id}/progress`
        assert.equal((await send(attemptPath, 'GET', undefined, one.cookie)).status, 409)
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
        await startTest.test('assigns saved question and option orders to only the starting roster', async () => {
          const { rows: assignments } = await pool!.query(
            `SELECT aq.participant_id, aq.question_id, aq.position, aq.option_order,
               ARRAY(SELECT o.id FROM question_options o WHERE o.question_id = aq.question_id) AS options
             FROM quiz_attempt_questions aq
             JOIN room_participants p ON p.id = aq.participant_id
             WHERE p.room_id = $1 ORDER BY aq.participant_id, aq.position`, [live.id],
          )
          assert.equal(assignments.length, 6)
          for (const member of [one, two]) {
            const order = assignments.filter(row => row.participant_id === member.participantId)
            assert.deepEqual(order.map(row => row.position), [1, 2, 3])
            assert.equal(new Set(order.map(row => row.question_id)).size, 3)
            for (const row of order) assert.deepEqual(new Set(row.option_order), new Set(row.options))

            const response = await send(attemptPath, 'GET', undefined, member.cookie)
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('Cache-Control'), 'no-store')
            const attempt = await response.json()
            assert.deepEqual(Object.keys(attempt).sort(), ['answered', 'deadlineAt', 'issuedAt', 'phase', 'question', 'serverNow', 'timedOut', 'total'])
            assert.equal(Date.parse(attempt.deadlineAt) - Date.parse(attempt.issuedAt), 10_000)
            assert.deepEqual(Object.keys(attempt.question).sort(), ['id', 'options', 'prompt'])
            assert.ok(attempt.question.options.every((option: object) => Object.keys(option).sort().join() === 'id,text'))
            assert.equal(attempt.question.id, order[0].question_id)
            assert.deepEqual(attempt.question.options.map((option: { id: string }) => option.id), order[0].option_order)
            assert.deepEqual(savedView(await (await send(attemptPath, 'GET', undefined, member.cookie)).json()), savedView(attempt))
          }
          const { rows: [repeated] } = await pool!.query('SELECT assign_quiz_attempts($1) AS assigned', [live.id])
          assert.equal(repeated.assigned, 0)
          assert.equal((await send(attemptPath, 'GET', undefined, observer.cookie)).status, 403)
          assert.equal((await send(attemptPath, 'GET', undefined, await guest())).status, 404)
          assert.equal((await send(attemptPath, 'GET', undefined, '')).status, 401)
        })
        await startTest.test('locks one answer, rejects future questions, and makes retries safe', async () => {
          const first = await (await send(attemptPath, 'GET', undefined, one.cookie)).json()
          const answerPath = `${attemptPath}/answers`
          const save = (input: { questionId: string; optionId: string; requestId: string }, cookie = one.cookie) => send(answerPath, 'POST', input, cookie)
          const { rows: [future] } = await pool!.query(
            'SELECT question_id, option_order FROM quiz_attempt_questions WHERE participant_id = $1 AND position = 2', [one.participantId],
          )
          const candidate = { questionId: first.question.id, optionId: first.question.options[0].id, requestId: randomUUID() }
          const alternative = { ...candidate, optionId: first.question.options[1].id, requestId: randomUUID() }
          assert.equal((await save({ ...candidate, questionId: future.question_id, optionId: future.option_order[0] })).status, 409)
          assert.equal((await save({ ...candidate, optionId: future.option_order[0] })).status, 400)
          assert.equal((await save(candidate, observer.cookie)).status, 403)
          assert.equal((await fetch(base + answerPath, { method: 'POST', headers: { Cookie: one.cookie } })).status, 403)

          const responses = await Promise.all([save(candidate), save(alternative)])
          assert.deepEqual(responses.map(response => response.status).sort(), [200, 409])
          const winner = responses[0].ok ? candidate : alternative
          const current = await responses.find(response => response.ok)!.json()
          assert.equal(current.question.id, future.question_id)
          assert.equal(current.answered, 1)
          assert.deepEqual(savedView(await (await save(winner)).json()), savedView(current))
          assert.deepEqual(savedView(await (await send(attemptPath, 'GET', undefined, one.cookie)).json()), savedView(current))
          assert.equal((await save({ ...winner, questionId: future.question_id, optionId: future.option_order[0] })).status, 409)

          const second = { questionId: current.question.id, optionId: current.question.options[0].id, requestId: randomUUID() }
          const retries = await Promise.all([save(second), save(second)])
          assert.deepEqual(retries.map(response => response.status), [200, 200])
          const last = await retries[0].json()
          assert.deepEqual(savedView(await retries[1].json()), savedView(last))
          assert.equal(last.answered, 2)
          const finished = await save({ questionId: last.question.id, optionId: last.question.options[0].id, requestId: randomUUID() })
          assert.deepEqual(await finished.json(), { phase: 'complete', answered: 3, timedOut: 0, total: 3 })
          assert.deepEqual(await (await save(winner)).json(), { phase: 'complete', answered: 3, timedOut: 0, total: 3 })
          assert.equal((await (await send(attemptPath, 'GET', undefined, two.cookie)).json()).answered, 0)
          const { rows: saved } = await pool!.query(
            'SELECT option_id, request_id FROM quiz_answers WHERE participant_id = $1', [one.participantId],
          )
          assert.equal(saved.length, 3)
          assert.equal(saved.find(row => row.request_id === winner.requestId)?.option_id, winner.optionId)
          assert.deepEqual(await (await send(resultsPath, 'GET', undefined, one.cookie)).json(), { phase: 'waiting' })
          assert.equal((await send(progressPath, 'GET', undefined, one.cookie)).status, 401)
          assert.equal((await send(progressPath, 'GET', undefined, otherCookie)).status, 404)
          const progress = await (await send(progressPath)).json()
          assert.equal(progress.phase, 'running')
          assert.deepEqual(progress.participants.map((entry: { resolved: number }) => entry.resolved).sort(), [0, 3])
          assert.deepEqual(Object.keys(progress.participants[0]).sort(), ['participantId', 'resolved', 'timedOut', 'total'])
        })
        await startTest.test('reconciles offline timeouts and rejects a late answer during refresh', async () => {
          const initial = await (await send(attemptPath, 'GET', undefined, two.cookie)).json()
          const { rows: [stamp] } = await pool!.query<{ issued_at: Date }>(
            `UPDATE quiz_attempts
             SET issued_at = date_trunc('milliseconds', now()) - interval '21 seconds',
                 deadline_at = date_trunc('milliseconds', now()) - interval '11 seconds'
             WHERE participant_id = $1 RETURNING issued_at`, [two.participantId],
          )
          async function savedAnswers() {
            const result = await pool!.query(
              'SELECT option_id, request_id, issued_at, deadline_at, submitted_at FROM quiz_answers WHERE participant_id = $1 ORDER BY submitted_at',
              [two.participantId],
            )
            return result.rows
          }

          // No browser requests while the background worker resolves both missed questions.
          const stop = Date.now() + 2_500
          while ((await savedAnswers()).length < 2 && Date.now() < stop) await delay(35)
          const missed = await savedAnswers()
          assert.equal(missed.length, 2)
          for (const [index, row] of missed.entries()) {
            assert.equal(row.option_id, null)
            assert.equal(row.request_id, null)
            assert.equal(row.issued_at.getTime(), stamp.issued_at.getTime() + index * 10_000)
            assert.equal(row.deadline_at.getTime() - row.issued_at.getTime(), 10_000)
            assert.deepEqual(row.submitted_at, row.deadline_at)
          }

          const late = { questionId: initial.question.id, optionId: initial.question.options[0].id, requestId: randomUUID() }
          const [refresh, submission] = await Promise.all([
            send(attemptPath, 'GET', undefined, two.cookie),
            send(`${attemptPath}/answers`, 'POST', late, two.cookie),
          ])
          assert.equal(submission.status, 409)
          const resumed = await refresh.json()
          assert.equal(resumed.answered, 0)
          assert.equal(resumed.timedOut, 2)
          assert.equal(Date.parse(resumed.issuedAt), stamp.issued_at.getTime() + 20_000)
          assert.equal(Date.parse(resumed.deadlineAt), stamp.issued_at.getTime() + 30_000)
          assert.deepEqual(savedView(await (await send(attemptPath, 'GET', undefined, two.cookie)).json()), savedView(resumed))

          // Put the last deadline in the past and race a submission with automatic advancement.
          await pool!.query(
            "UPDATE quiz_attempts SET issued_at = now() - interval '11 seconds', deadline_at = now() - interval '1 second' WHERE participant_id = $1",
            [two.participantId],
          )
          const answer = { questionId: resumed.question.id, optionId: resumed.question.options[0].id, requestId: randomUUID() }
          const conflict = await send(`${attemptPath}/answers`, 'POST', answer, two.cookie)
          assert.equal(conflict.status, 409)
          assert.equal((await savedAnswers()).length, 3)
          assert.deepEqual(await (await send(attemptPath, 'GET', undefined, two.cookie)).json(), {
            phase: 'complete', answered: 0, timedOut: 3, total: 3,
          })
          assert.equal((await savedAnswers()).filter(row => row.request_id === null).length, 3)
        })
        const published = await until(details => !!details.room.resultsPublishedAt)
        assert.equal(published.room.status, 'closed')
        assert.equal((await send(attemptPath, 'GET', undefined, one.cookie)).status, 200)
        assert.equal((await send(resultsPath, 'GET', undefined, observer.cookie)).status, 403)
        assert.equal((await send(resultsPath, 'GET', undefined, await guest())).status, 404)
        const guestResult = await send(resultsPath, 'GET', undefined, two.cookie)
        assert.equal(guestResult.headers.get('Cache-Control'), 'no-store')
        const finalResults = await guestResult.json()
        assert.equal(finalResults.phase, 'final')
        assert.equal(finalResults.review.length, 3)
        assert.ok(finalResults.review.every((row: { outcome: string; selectedOption: string | null }) => row.outcome === 'timeout' && row.selectedOption === null))
        assert.equal(finalResults.standings.find((row: { participantNumber: number }) => row.participantNumber === finalResults.participantNumber).totalTimeMs, 30_000)
        assert.deepEqual(Object.keys(finalResults.standings[0]).sort(), ['correct', 'nickname', 'participantNumber', 'rank', 'total', 'totalTimeMs'])
        assert.deepEqual((await (await send(progressPath)).json()).standings, finalResults.standings)
        assert.equal((await read()).room.startedAt, final.room.startedAt)
      } finally {
        for (const socket of sockets) socket.disconnect()
      }
    })
    await context.test('archives one leaderboard with shared ranks and stable ordering after simultaneous finishes', async () => {
      const hosted = await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open' })
      assert.equal(hosted.status, 201)
      const { room: ranked } = await hosted.json()
      const members = []
      for (const nickname of ['Aster', 'Birch', 'Clover', 'Dahlia', 'Elm', 'Fir', 'Ginger']) {
        const cookie = await guest()
        const joined = await send(`/room-entry/${ranked.code}/join`, 'POST', { nickname }, cookie)
        assert.equal(joined.status, 200)
        const { participantId } = await joined.json()
        members.push({ participantId, cookie })
      }
      await pool!.query('UPDATE room_participants SET admitted = true WHERE room_id = $1', [ranked.id])
      await pool!.query('UPDATE rooms SET started_at = lobby_ends_at WHERE id = $1', [ranked.id])
      await pool!.query('SELECT assign_quiz_attempts($1)', [ranked.id])
      await pool!.query('SELECT start_quiz_timers($1)', [ranked.id])
      const [a, b, c, d, e, ...last] = members
      for (const [member, score, cost] of [[a, 3, 400], [b, 3, 400], [c, 3, 600], [d, 2, 50], [e, 2, null]] as const) {
        await pool!.query(
          `WITH stamp AS (SELECT now() - interval '2 seconds' AS issued)
           INSERT INTO quiz_answers (participant_id, question_id, option_id, request_id, submitted_at, issued_at, deadline_at)
           SELECT aq.participant_id, aq.question_id, CASE WHEN aq.position <= $2 THEN q.correct_option_id ELSE wrong.id END,
             gen_random_uuid(), stamp.issued + coalesce($3::integer, 1) * interval '1 millisecond',
             CASE WHEN $3::integer IS NOT NULL THEN stamp.issued END,
             CASE WHEN $3::integer IS NOT NULL THEN stamp.issued + interval '10 seconds' END
           FROM stamp, quiz_attempt_questions aq JOIN questions q ON q.id = aq.question_id
           JOIN LATERAL (SELECT id FROM question_options WHERE question_id = q.id AND id <> q.correct_option_id LIMIT 1) wrong ON true
           WHERE aq.participant_id = $1`, [member.participantId, score, cost],
        )
        await pool!.query('UPDATE quiz_attempts SET next_position = total_questions + 1, issued_at = NULL, deadline_at = NULL WHERE participant_id = $1', [member.participantId])
      }
      const path = `/guest/rooms/${ranked.id}/attempt`
      async function answerCurrent(member: typeof a) {
        const current = await (await send(path, 'GET', undefined, member.cookie)).json()
        assert.equal(current.phase, 'question')
        const { rows: [wrong] } = await pool!.query(
          'SELECT o.id FROM question_options o JOIN questions q ON q.id = o.question_id WHERE q.id = $1 AND o.id <> q.correct_option_id LIMIT 1',
          [current.question.id],
        )
        const result = await send(`${path}/answers`, 'POST', { questionId: current.question.id, optionId: wrong.id, requestId: randomUUID() }, member.cookie)
        assert.equal(result.status, 200)
        return result.json()
      }
      for (let index = 0; index < 3; index++) {
        const views = await Promise.all(last.map(answerCurrent))
        assert.ok(views.every(view => view.phase === (index === 2 ? 'complete' : 'question')))
      }
      const standingsPath = `/rooms/${ranked.id}/progress`
      let result = await (await send(standingsPath)).json()
      const stop = Date.now() + 2_500
      while (result.phase !== 'final' && Date.now() < stop) {
        await delay(30)
        result = await (await send(standingsPath)).json()
      }
      assert.equal(result.phase, 'final')
      assert.deepEqual(result.standings.slice(0, 5).map((row: { rank: number; nickname: string; totalTimeMs: number | null }) =>
        [row.rank, row.nickname, row.totalTimeMs]), [[1, 'Aster', 1200], [1, 'Birch', 1200], [3, 'Clover', 1800], [4, 'Dahlia', 150], [5, 'Elm', null]])
      assert.equal(result.standings.length, 7)
      assert.deepEqual(await (await send(standingsPath)).json(), result)
      assert.equal((await send(`/rooms/${ranked.id}/cancel`, 'POST', { reason: 'Too late' })).status, 409)
      assert.deepEqual(await (await send(standingsPath)).json(), result)
    })

    async function startFixture(nickname: string) {
      const next = await send('/rooms', 'POST', { competitionId: draft.id, admissionMode: 'open', lobbySeconds: 0 })
      assert.equal(next.status, 201)
      const { room: interrupted } = await next.json()
      const interruptedCookie = await guest()
      const admitted = await send(`/room-entry/${interrupted.code}/join`, 'POST', { nickname }, interruptedCookie)
      assert.equal(admitted.status, 200)
      const { participantId } = await admitted.json()
      await pool!.query('UPDATE room_participants SET admitted = true WHERE id = $1', [participantId])
      await pool!.query('UPDATE rooms SET started_at = lobby_ends_at WHERE id = $1', [interrupted.id])
      await pool!.query('SELECT assign_quiz_attempts($1)', [interrupted.id])
      await pool!.query('SELECT start_quiz_timers($1)', [interrupted.id])
      return { interrupted, interruptedCookie, participantId }
    }

    await context.test('requires an organiser reason, then serialises cancellation with a submitted answer', async () => {
      const { interrupted, interruptedCookie, participantId } = await startFixture('Still Playing')
      const cancelPath = `/rooms/${interrupted.id}/cancel`
      assert.equal((await send(`/rooms/${interrupted.id}/close`, 'POST', {})).status, 409)
      assert.equal((await send(cancelPath, 'POST', { reason: '   ' })).status, 400)
      assert.equal((await send(cancelPath, 'POST', { reason: 'Rescheduled' }, otherCookie)).status, 404)
      assert.equal((await send(cancelPath, 'POST', { reason: 'Rescheduled' }, interruptedCookie)).status, 401)
      const path = `/guest/rooms/${interrupted.id}/attempt`
      const { question } = await (await send(path, 'GET', undefined, interruptedCookie)).json()
      const answer = { questionId: question.id, optionId: question.options[0].id, requestId: randomUUID() }
      const [cancel, submission] = await Promise.all([
        send(cancelPath, 'POST', { reason: '  Rescheduled for Friday.  ' }),
        send(`${path}/answers`, 'POST', answer, interruptedCookie),
      ])
      assert.equal(cancel.status, 200)
      assert.ok([200, 409].includes(submission.status))
      assert.equal((await pool!.query('SELECT 1 FROM quiz_answers WHERE participant_id = $1', [participantId])).rowCount, submission.ok ? 1 : 0)
      assert.equal((await send(`${path}/answers`, 'POST', answer, interruptedCookie)).status, 409)
      assert.equal((await send(path, 'GET', undefined, interruptedCookie)).status, 409)
      const { room: cancelled } = await (await send(`/guest/rooms/${interrupted.id}`, 'GET', undefined, interruptedCookie)).json()
      assert.equal(cancelled.cancellationReason, 'organiser')
      assert.equal(cancelled.cancellationNote, 'Rescheduled for Friday.')
      const preview = await (await send(`/room-entry/${interrupted.code}`, 'GET', undefined, '')).json()
      assert.equal(preview.room.cancellationReason, 'organiser')
      assert.equal(preview.room.cancellationNote, null)
      const noResults = await send(`/guest/rooms/${interrupted.id}/results`, 'GET', undefined, interruptedCookie)
      assert.deepEqual(await noResults.json(), { phase: 'cancelled' })
      assert.equal((await pool!.query('SELECT 1 FROM quiz_results WHERE participant_id = $1', [participantId])).rowCount, 0)
    })

    await context.test('recovers running competitions before serving HTTP and preserves the lobby and published results', async () => {
      const { interrupted, interruptedCookie, participantId } = await startFixture('Offline on Restart')
      const pending = await createCompetition(pool!, other.id, { title: 'Waiting room', description: '', questionTimeSeconds: 10 })
      await saveQuestion(pool!, other.id, pending.id, { prompt: 'Choose A', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 })
      await publishCompetition(pool!, other.id, pending.id)
      const open = await send('/rooms', 'POST', { competitionId: pending.id, admissionMode: 'open' }, otherCookie)
      assert.equal(open.status, 201)
      const { room: lobby } = await open.json()
      const standings = await pool!.query('SELECT * FROM quiz_results ORDER BY participant_id')
      assert.ok(standings.rows.length > 0)

      const duplicate = createQuizzentServer(pool!)
      try {
        await assert.rejects(duplicate.start(port), { code: 'EADDRINUSE' })
      } finally { await duplicate.close() }
      const before = await (await send(`/rooms/${interrupted.id}`)).json()
      assert.equal(before.room.status, 'open')

      await runtime!.close()
      await pool!.query(
        "UPDATE quiz_attempts SET issued_at = now() - interval '40 seconds', deadline_at = now() - interval '30 seconds' WHERE participant_id = $1",
        [participantId],
      )
      runtime = createQuizzentServer(pool!, reconnectGrace, warningMs)
      assert.equal(await runtime.start(port), 1)
      const recovered = await (await send(`/guest/rooms/${interrupted.id}`, 'GET', undefined, interruptedCookie)).json()
      assert.equal(recovered.room.cancellationReason, 'server_outage')
      assert.equal(recovered.room.resultsPublishedAt, null)
      assert.equal((await send(`/guest/rooms/${interrupted.id}/attempt`, 'GET', undefined, interruptedCookie)).status, 409)
      assert.deepEqual(await (await send(`/guest/rooms/${interrupted.id}/results`, 'GET', undefined, interruptedCookie)).json(), { phase: 'cancelled' })
      const waiting = await (await send(`/rooms/${lobby.id}`, 'GET', undefined, otherCookie)).json()
      assert.equal(waiting.room.status, 'open')
      assert.equal(waiting.room.cancellationReason, null)
      await delay(650)
      assert.equal((await pool!.query('SELECT 1 FROM quiz_answers WHERE participant_id = $1', [participantId])).rowCount, 0)
      assert.deepEqual((await pool!.query('SELECT * FROM quiz_results ORDER BY participant_id')).rows, standings.rows)
    })
  } finally {
    await runtime?.close()
    await pool?.end()
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`) }
    finally { await admin.end() }
  }
})
