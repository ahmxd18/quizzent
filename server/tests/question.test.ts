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

test('question editing API', async context => {
  assert.ok(process.env.DATABASE_URL)
  const schema = `quizzent_questions_test_${randomUUID().replaceAll('-', '')}`
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
    const owner = await createOrganiser(pool, { displayName: 'Question Owner', email: 'questions@example.test', password: 'long question test passphrase' })
    const other = await createOrganiser(pool, { displayName: 'Other Owner', email: 'other@example.test', password: 'another question test passphrase' })
    const draft = await createCompetition(pool, owner.id, { title: 'Question test', description: '', questionTimeSeconds: 10 })
    const cookieName = process.env.NODE_ENV === 'production' ? '__Host-quizzent_session' : 'quizzent_session'
    const cookie = `${cookieName}=${await createSession(pool, owner.id)}`
    const otherCookie = `${cookieName}=${await createSession(pool, other.id)}`
    server = createApp(pool).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/competitions/${draft.id}/questions`
    const send = (path = '', method = 'GET', body?: unknown, session = cookie) => fetch(`${base}${path}`, {
      method, headers: { Cookie: session, 'Content-Type': 'application/json', 'X-Quizzent-Request': '1' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const input = { prompt: '  Which planet is known as the red planet?  ', options: ['  Mars ', 'Earth', 'Venus', 'Jupiter'], correctOptionIndex: 0 }
    let question: { id: string; correctOptionId: string; options: { id: string; text: string }[] }

    await context.test('requires sessions, ownership, and cross-site protection', async () => {
      assert.equal((await send('', 'GET', undefined, '')).status, 401)
      assert.equal((await send('', 'GET', undefined, otherCookie)).status, 404)
      assert.equal((await send('', 'POST', input, otherCookie)).status, 404)
      assert.equal((await fetch(base, { method: 'POST', headers: { Cookie: cookie } })).status, 403)
      assert.equal((await fetch(`${base}/${randomUUID()}`, { method: 'DELETE', headers: { Cookie: cookie } })).status, 403)
    })
    await context.test('rejects incomplete, duplicate, oversized, and privileged input', async () => {
      for (const body of [{ ...input, prompt: ' ' }, { ...input, options: ['A', 'B'] }, { ...input, correctOptionIndex: 4 },
        { ...input, correctOptionIndex: 0.5 }, { ...input, options: ['Mars', ' mars ', 'Earth', 'Venus'] },
        { ...input, options: [' ', 'B', 'C', 'D'] }, { ...input, prompt: 'x'.repeat(1001) },
        { ...input, options: ['x'.repeat(201), 'B', 'C', 'D'] }, { ...input, competitionId: randomUUID() }]) {
        assert.equal((await send('', 'POST', body)).status, 400)
      }
      assert.deepEqual(await (await send()).json(), { questions: [] })
      assert.equal((await send('/bad-id', 'PUT', input)).status, 400)
    })
    await context.test('creates, normalises, and preserves question/option identities on edit', async () => {
      const response = await send('', 'POST', input)
      assert.equal(response.status, 201)
      question = (await response.json()).question
      assert.equal(question.options[0].text, 'Mars')
      assert.equal(question.correctOptionId, question.options[0].id)
      const edit = await send(`/${question.id}`, 'PUT', { ...input, prompt: 'Updated question?', correctOptionIndex: 2 })
      assert.equal(edit.status, 200)
      const saved = (await edit.json()).question
      assert.equal(saved.id, question.id)
      assert.deepEqual(saved.options.map((option: { id: string }) => option.id), question.options.map(option => option.id))
      assert.equal(saved.correctOptionId, question.options[2].id)
      assert.equal((await send(`/${question.id}`, 'PUT', input, otherCookie)).status, 404)
      assert.equal((await send(`/${randomUUID()}`, 'PUT', input)).status, 404)
    })
    await context.test('serialises simultaneous additions without duplicate positions', async () => {
      const responses = await Promise.all([send('', 'POST', input), send('', 'POST', input)])
      assert.ok(responses.every(response => response.status === 201))
      const { questions } = await (await send()).json()
      assert.deepEqual(questions.map((item: { position: number }) => item.position), [1, 2, 3])
    })
    await context.test('database rejects a correct answer from another question', async () => {
      const { questions } = await (await send()).json()
      const client = await pool!.connect()
      try {
        await client.query('BEGIN')
        await client.query('UPDATE questions SET correct_option_id = $1 WHERE id = $2', [questions[1].options[0].id, questions[0].id])
        await assert.rejects(client.query('COMMIT'), { code: '23503' })
      } finally { await client.query('ROLLBACK'); client.release() }
    })
    await context.test('removes only an owned question and cascades its options', async () => {
      assert.equal((await send(`/${question.id}`, 'DELETE', undefined, otherCookie)).status, 404)
      assert.equal((await send(`/${question.id}`, 'DELETE')).status, 200)
      assert.equal((await pool!.query('SELECT id FROM question_options WHERE question_id = $1', [question.id])).rowCount, 0)
      assert.equal((await send(`/${question.id}`, 'DELETE')).status, 404)
    })
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    await pool?.end()
    try { if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`) }
    finally { await admin.end() }
  }
})
