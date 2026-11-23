import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import type { ScenarioFetch } from './room-scenario.js'

export async function browserTransport(origin: string) {
  const browser = await chromium.launch({ ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : { channel: process.env.BROWSER_CHANNEL ?? 'msedge' }), headless: true })
  const sessions = new Map<string, Awaited<ReturnType<typeof newPage>>>()
  async function newPage() {
    const page = await browser.newPage()
    // An inert same-origin document supplies real browser cookie and HTTP behaviour.
    await page.goto(origin + '/favicon.svg')
    return page
  }
  const anonymous = await newPage()
  const request: ScenarioFetch = async (input, init) => {
    const cookie = new Headers(init.headers).get('cookie') ?? ''
    const guestBootstrap = input.endsWith('/api/guest/session') && !cookie
    const page = guestBootstrap ? await newPage() : cookie ? sessions.get(cookie) : anonymous
    assert.ok(page, 'The browser session must exist before an authenticated request.')
    const result = await page.evaluate(async ({ input, method, body }) => {
      const response = await fetch(input, { method, headers: { 'Content-Type': 'application/json', 'X-Quizzent-Request': '1' }, body, signal: AbortSignal.timeout(15_000) })
      return { status: response.status, text: await response.text(), headers: [...response.headers.entries()] }
    }, { input, method: init.method, body: typeof init.body === 'string' ? init.body : undefined })
    const headers = new Headers(result.headers)
    if (result.status === 200 && (input.endsWith('/api/auth/login') || guestBootstrap)) {
      const name = guestBootstrap ? '__Host-quizzent_guest' : '__Host-quizzent_session'
      const saved = (await page.context().cookies()).find(item => item.name === name)
      assert.ok(saved?.secure && saved.httpOnly && saved.sameSite === 'Lax' && saved.path === '/', 'Production cookie flags')
      const key = `${saved.name}=${saved.value}`
      sessions.set(key, page)
      headers.set('set-cookie', `${key}; Path=/; Secure; HttpOnly; SameSite=Lax`)
    }
    return new Response(result.text, { status: result.status, headers })
  }
  return { request, close: () => browser.close() }
}
