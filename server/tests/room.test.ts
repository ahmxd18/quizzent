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
import { createCompetition } from '../src/features/competitions/competition.service.js'
import { publishCompetition } from '../src/features/competitions/publication.service.js'
import { saveQuestion } from '../src/features/questions/question.service.js'
import { createGuestSession } from '../src/features/rooms/guest-session.service.js'
import { hashSecret } from '../src/lib/secrets.js'
import { joinRoom } from '../src/features/rooms/admission.service.js'

test('rooms and guest admission', async context => {
  assert.ok(process.env.DATABASE_URL)
  const schema = `quizzent_rooms_test_${randomUUID().replaceAll('-', '')}`
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
    const owner = await createOrganiser(pool, { displayName: 'Room Owner', email: 'rooms@example.test', password: 'long room test passphrase' })
    const other = await createOrganiser(pool, { displayName: 'Other Owner', email: 'other@example.test', password: 'another room test passphrase' })
    const draft = await createCompetition(pool, owner.id, { title: 'Room Test', description: '', questionTimeSeconds: 10 })
    await saveQuestion(pool, owner.id, draft.id, { prompt: 'Pick A', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 })
    await publishCompetition(pool, owner.id, draft.id)
    const unpublished = await createCompetition(pool, owner.id, { title: 'Not ready', description: '', questionTimeSeconds: 10 })
    const ownerCookie = `quizzent_session=${await createSession(pool, owner.id)}`
    const otherCookie = `quizzent_session=${await createSession(pool, other.id)}`
    server = createApp(pool).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
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
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    await pool?.end()
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`) }
    finally { await admin.end() }
  }
})
