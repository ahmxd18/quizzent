import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const origin = process.env.QUIZZENT_HOSTED_ORIGIN
assert.ok(origin, 'Set QUIZZENT_HOSTED_ORIGIN. This check creates labelled test records.')
assert.equal(new URL(origin).origin, origin)
assert.equal(new URL(origin).protocol, 'https:')
const artifacts = resolve(process.env.BROWSER_ARTIFACTS ?? resolve(tmpdir(), 'quizzent-hosted-browser'))
await mkdir(artifacts, { recursive: true })
const email = `ui-check-${randomUUID()}@example.test`
const password = randomUUID() + randomUUID()
const axe = await readFile(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8')
const browser = await chromium.launch({ ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : { channel: process.env.BROWSER_CHANNEL ?? 'msedge' }), headless: true })
const failures = []
let stage = 'opening the website'
try {
  const organiser = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const guest = await browser.newPage({ viewport: { width: 375, height: 815 }, isMobile: true, hasTouch: true })
  for (const page of [organiser, guest]) {
    page.setDefaultTimeout(30_000)
    page.on('pageerror', error => failures.push(error.message))
    page.on('console', message => {
      if (/violates.*Content Security Policy|Refused to.*(script|style|connect)/i.test(message.text())) failures.push(message.text())
    })
  }
  async function audit(page, name) {
    // DevTools evaluation runs the audit without relaxing the app's document CSP.
    await page.evaluate(axe)
    const result = await page.evaluate(async () => globalThis.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    assert.deepEqual(result.violations.map(item => item.id), [], name)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`)
    console.log(`Hosted accessibility passed: ${name}`)
  }
  await organiser.goto(origin, { waitUntil: 'networkidle' })
  await organiser.getByRole('button', { name: 'Pause preview', exact: true }).click()
  await audit(organiser, 'overview')
  stage = 'creating the verification organiser'
  await organiser.goto(origin + '/signup')
  await organiser.getByLabel('Your name').fill('Hosted UI Verification')
  await organiser.getByLabel('Email address').fill(email)
  await organiser.getByLabel('Password', { exact: true }).fill(password)
  await organiser.getByRole('button', { name: 'Create organiser account', exact: true }).click()
  await organiser.getByRole('link', { name: 'Continue to login', exact: true }).waitFor()
  await organiser.goto(origin + '/login')
  await organiser.getByLabel('Email address').fill(email)
  await organiser.getByLabel('Password').fill(password)
  await organiser.getByRole('button', { name: 'Log in', exact: true }).click()
  await organiser.waitForURL('**/organiser')
  const cookie = (await organiser.context().cookies()).find(item => item.name === '__Host-quizzent_session')
  assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax' && cookie.path === '/')
  await organiser.reload()
  await organiser.getByRole('button', { name: 'Log out', exact: true }).waitFor()
  stage = 'creating and publishing a competition'
  await organiser.goto(origin + '/organiser/competitions/new')
  await organiser.getByLabel('Competition title').fill('Hosted browser verification')
  await organiser.getByLabel('Time per question (seconds)').fill('30')
  await organiser.getByRole('button', { name: 'Create draft', exact: true }).click()
  await organiser.waitForURL('**/organiser')
  await organiser.getByRole('link').filter({ hasText: 'Hosted browser verification' }).click()
  await organiser.getByRole('link', { name: 'Manage questions', exact: true }).click()
  await organiser.getByRole('button', { name: 'Add question', exact: true }).click()
  await organiser.getByLabel('Question', { exact: true }).fill('Which letter comes first?')
  for (const letter of ['A', 'B', 'C', 'D']) await organiser.getByLabel(`Option ${letter}`, { exact: true }).fill(letter)
  await organiser.getByRole('radio', { name: 'Option A is correct' }).check()
  await organiser.getByRole('button', { name: 'Save question', exact: true }).click()
  await organiser.getByRole('button', { name: 'Publish competition', exact: true }).click()
  await organiser.getByRole('dialog').getByRole('button', { name: 'Publish and lock', exact: true }).click()
  await organiser.getByLabel('Lobby countdown (seconds)').fill('0')
  await organiser.getByLabel('Minimum ready guests').fill('1')
  assert.equal(await organiser.getByLabel('Lobby countdown (seconds)').inputValue(), '0')
  assert.equal(await organiser.getByLabel('Minimum ready guests').inputValue(), '1')
  const opened = organiser.waitForRequest(request => request.url() === origin + '/api/rooms' && request.method() === 'POST')
  await organiser.getByRole('button', { name: 'Open room', exact: true }).click()
  console.log('Host settings sent:', JSON.stringify((await opened).postDataJSON()))
  await organiser.waitForURL('**/organiser/rooms/*')
  const roomId = organiser.url().split('/').at(-1)
  const details = await organiser.request.get(`${origin}/api/rooms/${roomId}`)
  assert.equal(details.status(), 200)
  const { room } = await details.json()
  console.log('Host settings saved:', JSON.stringify({ minReady: room.minReady, lobbyEndsAt: room.lobbyEndsAt }))
  assert.equal(room.minReady, 1)
  stage = 'joining and playing over HTTPS'
  await guest.goto(origin + '/join/' + room.code)
  await guest.getByLabel('Your nickname').fill('Hosted Guest')
  await guest.getByRole('button', { name: 'Join room', exact: true }).click()
  await guest.getByRole('button', { name: 'I’m ready', exact: true }).waitFor()
  await audit(guest, 'mobile lobby')
  await guest.getByRole('button', { name: 'I’m ready', exact: true }).click()
  await guest.getByRole('heading', { name: 'Which letter comes first?', exact: true }).waitFor()
  await audit(guest, 'mobile timed question')
  await guest.getByRole('radio', { name: 'A', exact: true }).check()
  await guest.getByRole('button', { name: 'Submit answer', exact: true }).click()
  stage = 'checking saved results'
  await guest.getByRole('heading', { name: 'Final leaderboard', exact: true }).waitFor()
  await guest.getByText('1/1 correct', { exact: true }).waitFor()
  await guest.reload()
  await guest.getByRole('heading', { name: 'Final leaderboard', exact: true }).waitFor()
  await audit(guest, 'mobile results after refresh')
  await guest.screenshot({ path: resolve(artifacts, 'hosted-result-mobile.png'), fullPage: true })
  await organiser.getByRole('button', { name: 'Log out', exact: true }).click()
  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ origin, roomId, verified: ['HTTPS session cookie', 'login refresh', 'draft and publication', 'WSS readiness', 'answer and results', 'guest result refresh', 'document CSP', 'desktop/mobile accessibility', 'logout'] }))
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.log('Page state:', (await page.locator('body').innerText()).slice(-1800).replaceAll(password, '[REDACTED]'))
  }
  console.error(`Hosted browser failed while ${stage}: ${String(error.message).replaceAll(password, '[REDACTED]')}`)
  process.exitCode = 1
} finally { await browser.close() }
