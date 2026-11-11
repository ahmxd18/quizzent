import express from 'express'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { loginSchema } from './login.schema.js'
import { hashPassword, verifyPassword } from './password.js'
import { createSession, deleteSession, findSessionUser, sessionLifetimeMs, type SessionUser } from './session.service.js'

export function createSessionRouter(database: Pool) {
  const router = express.Router()
  const production = process.env.NODE_ENV === 'production'
  const cookieName = production ? '__Host-quizzent_session' : 'quizzent_session'
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax' as const, path: '/' }
  // Reuse one dummy hash so unknown emails still take a password check.
  let dummyHash: Promise<string> | undefined
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again later.' } })

  router.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next() })
  router.use(cookieParser())
  const readToken = (request: express.Request): string | undefined => {
    const token: unknown = request.cookies?.[cookieName]
    return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token) ? token : undefined
  }

  router.use((request, response, next) => {
    if (request.method === 'POST' && (request.get('X-Quizzent-Request') !== '1' || request.get('Sec-Fetch-Site') === 'cross-site')) {
      // Another site cannot send this header without a CORS preflight. We do not allow CORS.
      response.status(403).json({ message: 'This request must come from Quizzent.' })
      return
    }
    next()
  })

  router.post('/login', limiter, (request, response, next) => {
    if (!request.is('application/json')) { response.status(415).json({ message: 'Send login details as JSON.' }); return }
    next()
  }, express.json({ limit: '8kb' }), async (request, response) => {
    const result = loginSchema.safeParse(request.body)
    if (!result.success) { response.status(400).json({ message: 'Enter a valid email address and password.' }); return }
    const { rows: [account] } = await database.query<SessionUser & { password_hash: string; status: string }>(
      'SELECT id, display_name AS "displayName", email, role, status, password_hash FROM users WHERE lower(email) = $1', [result.data.email])
    const storedHash = account?.password_hash ?? await (dummyHash ??= hashPassword('Unused random-account timing placeholder'))
    const matches = await verifyPassword(result.data.password, storedHash)
    if (!account || !matches || account.status !== 'active') {
      response.status(401).json({ message: 'Email or password is incorrect.' })
      return
    }
    const token = await createSession(database, account.id, readToken(request))
    const { id, displayName, email, role } = account
    response.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionLifetimeMs })
    response.json({ user: { id, displayName, email, role } })
  })

  router.get('/session', async (request, response) => {
    const token = readToken(request)
    const user = token ? await findSessionUser(database, token) : null
    if (!user) {
      response.clearCookie(cookieName, cookieOptions)
      response.status(401).json({ message: 'Please log in to continue.' })
      return
    }
    response.json({ user })
  })

  router.post('/logout', async (request, response) => {
    const token = readToken(request)
    if (token) await deleteSession(database, token)
    response.clearCookie(cookieName, cookieOptions)
    response.json({ message: 'You have been logged out.' })
  })
  return router
}
