import assert from 'node:assert/strict'
import { roomScenario } from './helpers/room-scenario.js'
import { browserTransport } from './helpers/browser-transport.js'

const value = process.env.QUIZZENT_HOSTED_ORIGIN
assert.ok(value, 'Set QUIZZENT_HOSTED_ORIGIN explicitly. This check creates labelled test accounts and competitions.')
const url = new URL(value)
assert.equal(url.protocol, 'https:', 'Hosted verification requires HTTPS.')
assert.equal(url.origin, value, 'Use an origin without a path or trailing slash.')
assert.equal(url.username + url.password, '', 'Do not include credentials in the website URL.')

for (const path of ['/', '/login', '/signup', '/api/health', '/api/not-a-route', '/assets/missing.js', '/.env']) {
  const response: Response = await fetch(value + path, { signal: AbortSignal.timeout(90_000) })
  assert.equal(response.status, ['/api/not-a-route', '/assets/missing.js', '/.env'].includes(path) ? 404 : 200, path)
  if (path.startsWith('/api')) assert.equal(response.headers.get('cache-control'), 'no-store')
  if (path === '/') {
    assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'none'/)
    assert.match(response.headers.get('strict-transport-security')!, /max-age=/)
    assert.equal(response.headers.get('cache-control'), 'no-cache')
  }
  await response.arrayBuffer()
}
const crossSite = await fetch(value + '/api/auth/logout', {
  method: 'POST', headers: { Origin: 'https://another-site.example', 'X-Quizzent-Request': '1' },
})
assert.equal(crossSite.status, 403)
await crossSite.arrayBuffer()

for (const count of [30, 50]) {
  const client = await browserTransport(value)
  try { console.log(JSON.stringify(await roomScenario(count, value, client.request), null, 2)) }
  finally { await client.close() }
}
