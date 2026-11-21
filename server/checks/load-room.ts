import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { io, type Socket } from 'socket.io-client'
import { createQuizzentServer } from '../src/server.js'
import { testDatabase } from '../tests/helpers/test-database.js'

type Attempt = {
  phase: string; answered: number; timedOut: number; total: number; deadlineAt: string
  question: { id: string; options: { id: string; text: string }[] }
}
type Member = { cookie: string; participantId: string }
type Counts = { onlineCount: number; readyCount: number }

function summary(samples: number[]) {
  const sorted = samples.toSorted((a, b) => a - b)
  const percentile = (value: number) => Math.round(sorted[Math.ceil(value * sorted.length) - 1])
  return { requests: sorted.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), maxMs: Math.round(sorted.at(-1)!) }
}

async function scenario(competitors: number) {
  const database = await testDatabase()
  const runtime = createQuizzentServer(database.pool)
  const sockets: Socket[] = []
  const timings = new Map<string, number[]>()
  let requestCount = 0
  const began = performance.now()
  try {
    await runtime.start(0)
    const origin = `http://127.0.0.1:${(runtime.server.address() as AddressInfo).port}`
    async function request(path: string, method = 'GET', body?: unknown, cookie = '', stage = 'setup', expected = 200) {
      const start = performance.now()
      const response = await fetch(`${origin}/api${path}`, {
        method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-Quizzent-Request': '1' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000),
      })
      const json = await response.json()
      requestCount++
      const samples = timings.get(stage) ?? []
      samples.push(performance.now() - start)
      timings.set(stage, samples)
      assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(json)}`)
      return { json, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' }
    }
    const credentials = { email: 'host@example.test', password: 'a long disposable load test password' }
    await request('/auth/signup', 'POST', { ...credentials, displayName: 'Load Check Host' }, '', 'setup', 201)
    const owner = (await request('/auth/login', 'POST', credentials)).cookie
    assert.ok(owner)
    const competition = (await request('/competitions', 'POST', { title: `Load check: ${competitors} guests`, questionTimeSeconds: 5 }, owner, 'setup', 201)).json.competition
    for (let index = 1; index <= 3; index++) {
      await request(`/competitions/${competition.id}/questions`, 'POST', {
        prompt: `Load question ${index}`, options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0,
      }, owner, 'setup', 201)
    }
    await request(`/competitions/${competition.id}/publish`, 'POST', {}, owner)
    const room = (await request('/rooms', 'POST', { competitionId: competition.id, admissionMode: 'open', lobbySeconds: 0, minReady: competitors }, owner, 'setup', 201)).json.room
    const members: Member[] = await Promise.all(Array.from({ length: competitors }, async (_, index) => {
      const cookie = (await request('/guest/session', 'POST', {}, '', 'guest-session')).cookie
      assert.ok(cookie)
      await request(`/room-entry/${room.code}`, 'GET', undefined, cookie, 'preview')
      const joined = await request(`/room-entry/${room.code}/join`, 'POST', { nickname: `Load Guest ${index + 1}` }, cookie, 'join')
      return { cookie, participantId: joined.json.participantId }
    }))
    assert.equal(new Set(members.map(member => member.participantId)).size, competitors)

    let counts: Counts = { onlineCount: 0, readyCount: 0 }
    async function connect(role: 'guest' | 'organiser', cookie: string) {
      const start = performance.now()
      const socket = io(origin, {
        auth: { role, roomId: room.id }, extraHeaders: { Cookie: cookie, Origin: origin },
        transports: ['websocket'], autoConnect: false, reconnection: false,
      })
      sockets.push(socket)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Lobby connection timed out')), 15_000)
        socket.once('connect_error', error => { clearTimeout(timer); reject(error) })
        socket.once('lobby:state', state => {
          clearTimeout(timer)
          if (role === 'guest') assert.equal(state.participants, undefined)
          resolve()
        })
        socket.connect()
      })
      const samples = timings.get('socket-connect') ?? []
      samples.push(performance.now() - start)
      timings.set('socket-connect', samples)
      return socket
    }
    const host = await connect('organiser', owner)
    host.on('lobby:state', state => { counts = state })
    const guests = await Promise.all(members.map(member => connect('guest', member.cookie)))
    await Promise.all(guests.map(async socket => {
      const start = performance.now()
      const reply = await socket.timeout(15_000).emitWithAck('lobby:ready', true)
      assert.equal(reply.ok, true)
      const samples = timings.get('ready-ack') ?? []
      samples.push(performance.now() - start)
      timings.set('ready-ack', samples)
    }))
    async function until(check: () => Promise<boolean>, description: string) {
      const deadline = Date.now() + 15_000
      while (!await check()) {
        assert.ok(Date.now() < deadline, `${description} timed out`)
        await delay(100)
      }
    }
    await until(async () => counts.readyCount === competitors && counts.onlineCount === competitors, 'Ready roster')
    await until(async () => !!(await request(`/rooms/${room.id}`, 'GET', undefined, owner, 'host-poll')).json.room.startedAt, 'Normal five-second warning')
    const attempts: Attempt[] = (await Promise.all(members.map(member => request(`/guest/rooms/${room.id}/attempt`, 'GET', undefined, member.cookie, 'attempt-read')))).map(result => result.json)
    const retries: { questionId: string; optionId: string; requestId: string }[] = []
    for (let index = 0; index < 2; index++) {
      await Promise.all(members.map(async (member, memberIndex) => {
        const current = attempts[memberIndex]
        assert.equal(current.phase, 'question')
        assert.equal(JSON.stringify(current).includes('correctOption'), false)
        const answer = { questionId: current.question.id, optionId: current.question.options[0].id, requestId: randomUUID() }
        const next = await request(`/guest/rooms/${room.id}/attempt/answers`, 'POST', answer, member.cookie, 'answer-burst')
        assert.equal(next.json.answered, index + 1)
        assert.equal(next.json.timedOut, 0)
        attempts[memberIndex] = next.json
        retries[memberIndex] = answer
      }))
    }
    // Retried requests must return the same progress and must not answer question three.
    await Promise.all(members.map(async (member, index) => {
      const retry = await request(`/guest/rooms/${room.id}/attempt/answers`, 'POST', retries[index], member.cookie, 'answer-retry')
      assert.equal(retry.json.answered, 2)
      assert.equal(retry.json.deadlineAt, attempts[index].deadlineAt)
    }))
    // Everyone leaves question three unanswered: the real timeout worker must finish it.
    await until(async () => (await request(`/rooms/${room.id}/progress`, 'GET', undefined, owner, 'host-poll')).json.phase === 'final', 'Timeout and result publication')
    const results = await Promise.all(members.map(member => request(`/guest/rooms/${room.id}/results`, 'GET', undefined, member.cookie, 'results')))
    for (const result of results) {
      assert.equal(result.json.phase, 'final')
      assert.equal(result.json.standings.length, competitors)
      assert.equal(result.json.review.length, 3)
      assert.equal(result.json.review.filter((row: { outcome: string }) => row.outcome === 'timeout').length, 1)
    }
    const { rows: [saved] } = await database.pool.query(`SELECT
      (SELECT count(*)::integer FROM room_participants WHERE admitted) AS admitted,
      (SELECT count(*)::integer FROM quiz_answers) AS resolutions,
      (SELECT count(*)::integer FROM quiz_answers WHERE request_id IS NULL) AS timeouts,
      (SELECT count(*)::integer FROM quiz_results) AS results`)
    assert.deepEqual(saved, { admitted: competitors, resolutions: competitors * 3, timeouts: competitors, results: competitors })
    const publicationLagMs = Date.parse(results[0].json.publishedAt) - Math.max(...attempts.map(attempt => Date.parse(attempt.deadlineAt)))
    return { competitors, httpRequests: requestCount, errors: 0, elapsedMs: Math.round(performance.now() - began), publicationLagMs,
      saved, stages: Object.fromEntries([...timings].map(([name, samples]) => [name, summary(samples)])) }
  } finally {
    for (const socket of sockets) socket.disconnect()
    try { await runtime.close() } finally { await database.close() }
  }
}

// Fail the command on any bad response or invariant; never turn a failed run into a green report.
for (const competitors of [30, 50]) console.log(JSON.stringify(await scenario(competitors), null, 2))
