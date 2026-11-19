import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { createApp } from '../src/app.js'
import { createOrganiser } from '../src/features/auth/signup.service.js'
import { createSession } from '../src/features/auth/session.service.js'
import { createReadyLimit } from '../src/features/lobby/ready-limit.js'
import { isSameOrigin } from '../src/lib/same-origin.js'
import { testDatabase } from './helpers/test-database.js'

test('readiness budget is shared by participant, expires, and never borrows another guest budget', () => {
  const budget = createReadyLimit(2, 1_000)
  assert.equal(budget.allow('one', 0), true)
  assert.equal(budget.allow('one', 1), true)
  assert.equal(budget.allow('one', 2), false)
  assert.equal(budget.allow('two', 2), true)
  assert.equal(budget.allow('one', 1_000), true)
  budget.prune(2_001)
  assert.equal(budget.allow('one', 2_001), true)
  budget.clear()
  assert.equal(budget.allow('one', 2_002), true)
})

test('origin comparison checks the exact scheme, hostname and port', () => {
  const previous = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'production'
    assert.equal(isSameOrigin('https://quiz.example', 'quiz.example'), true)
    for (const origin of ['http://quiz.example', 'https://quiz.example.evil.test', 'https://quiz.example:8443', 'null']) {
      assert.equal(isSameOrigin(origin, 'quiz.example'), false)
    }
    assert.equal(isSameOrigin('https://quiz.example', undefined), false)
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
})

test('API security boundaries', async context => {
  const database = await testDatabase()
  const server = createApp(database.pool).listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const send = (path: string, headers: Record<string, string> = {}, method = 'GET') => fetch(`${origin}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-Quizzent-Request': '1', ...headers },
      ...(method === 'POST' ? { body: '{}' } : {}),
    })
    await context.test('security headers cover successes, unauthorised requests, malformed bodies and missing routes', async () => {
      for (const path of ['/health', '/competitions', '/not-a-route']) {
        const response = await send(path)
        assert.equal(response.headers.get('cache-control'), 'no-store')
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
        assert.equal(response.headers.get('x-frame-options'), 'DENY')
        assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'")
        assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin')
        assert.equal(response.headers.get('x-powered-by'), null)
        assert.equal(response.headers.get('access-control-allow-origin'), null)
      }
      const invalid = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Quizzent-Request': '1' }, body: '{' })
      assert.equal(invalid.status, 400)
      assert.equal(invalid.headers.get('cache-control'), 'no-store')
    })
    await context.test('blocks foreign and opaque origins even with the custom header and same-site metadata', async () => {
      for (const source of ['http://another-site.test', `${origin}.evil.test`, 'null']) {
        assert.equal((await send('/auth/logout', { Origin: source, 'Sec-Fetch-Site': 'same-site' }, 'POST')).status, 403)
      }
      assert.equal((await send('/auth/logout', { Origin: origin }, 'POST')).status, 200)
      assert.equal((await send('/auth/logout', {}, 'POST')).status, 200)
      assert.equal((await send('/auth/logout', { 'X-Quizzent-Request': '' }, 'POST')).status, 403)
      assert.equal((await send('/auth/logout', { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }, 'POST')).status, 403)
    })
    await context.test('limits writes across an account sessions without blocking reads or another organiser', async () => {
      const first = await createOrganiser(database.pool, { displayName: 'First', email: 'first@example.test', password: 'long security check password' })
      const second = await createOrganiser(database.pool, { displayName: 'Second', email: 'second@example.test', password: 'long security check password' })
      const cookie = async (id: string) => ({ Cookie: `quizzent_session=${await createSession(database.pool, id)}` })
      const headers = await cookie(first.id)
      for (let index = 0; index < 60; index++) assert.equal((await send('/competitions', headers, 'POST')).status, 400)
      const limited = await send('/competitions', await cookie(first.id), 'POST')
      assert.equal(limited.status, 429)
      assert.ok(limited.headers.get('retry-after'))
      assert.equal((await send('/competitions', headers)).status, 200)
      assert.equal((await send('/competitions', await cookie(second.id), 'POST')).status, 400)
    })
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await database.close()
  }
})
