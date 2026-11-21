import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Pool } from 'pg'
import { createApp } from '../src/app.js'
import { readRuntimeConfig } from '../src/runtime-config.js'

test('deployment settings require an HTTPS public origin and bounded proxy trust', () => {
  assert.equal(readRuntimeConfig({}).host, '127.0.0.1')
  const settings = readRuntimeConfig({ NODE_ENV: 'production', PORT: '10000', RENDER_EXTERNAL_URL: 'https://quizzent.example', TRUST_PROXY_HOPS: '1' })
  assert.equal(settings.host, '0.0.0.0')
  assert.equal(settings.port, 10000)
  assert.equal(settings.frontend?.origin, 'https://quizzent.example')
  assert.equal(settings.trustedProxyHops, 1)
  assert.throws(() => readRuntimeConfig({ NODE_ENV: 'production' }), /PUBLIC_ORIGIN/)
  for (const origin of ['http://quizzent.example', 'https://user:secret@quizzent.example', 'https://quizzent.example/path', 'https://quizzent.example?token=x']) {
    assert.throws(() => readRuntimeConfig({ NODE_ENV: 'production', PUBLIC_ORIGIN: origin }))
  }
  for (const input of [{ PORT: '0' }, { PORT: '1.5' }, { HOST: 'public.example' }, { TRUST_PROXY_HOPS: 'true' }, { TRUST_PROXY_HOPS: '2' }]) {
    assert.throws(() => readRuntimeConfig(input))
  }
})

test('production frontend preserves API boundaries, security headers and asset caching', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quizzent-frontend-'))
  const database = new Pool() // Anonymous requests below never need a database connection.
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined
  try {
    await mkdir(join(directory, 'assets'))
    await writeFile(join(directory, 'index.html'), '<!doctype html><title>Quizzent fixture</title><div id="root"></div>')
    await writeFile(join(directory, 'assets', 'app-test.js'), 'console.log("fixture")')
    const app = createApp(database, undefined, { frontend: { directory, origin: 'https://quizzent.example' }, trustedProxyHops: 1 })
    server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    for (const path of ['/', '/login', '/organiser/competitions/new', '/rooms/test-room']) {
      const response = await fetch(base + path)
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type')!, /text\/html/)
      assert.equal(response.headers.get('cache-control'), 'no-cache')
      assert.match(response.headers.get('content-security-policy')!, /connect-src 'self' wss:\/\/quizzent.example/)
      assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000')
      assert.match(await response.text(), /Quizzent fixture/)
    }
    const script = await fetch(base + '/assets/app-test.js')
    assert.equal(script.status, 200)
    assert.match(script.headers.get('cache-control')!, /immutable/)
    for (const path of ['/assets/missing.js', '/.env', '/server/.env', '/%2eenv', '/api/missing']) {
      const response = await fetch(base + path)
      assert.equal(response.status, 404)
      assert.doesNotMatch(await response.text(), /Quizzent fixture/)
    }
    const session = await fetch(base + '/api/auth/session')
    assert.equal(session.status, 401)
    assert.equal(session.headers.get('cache-control'), 'no-store')
    assert.equal(session.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'")
    assert.equal((await fetch(base + '/api/health')).status, 200)
    assert.equal((await fetch(base + '/login', { method: 'POST' })).status, 404)
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    await database.end()
    await rm(directory, { recursive: true, force: true })
  }
})

