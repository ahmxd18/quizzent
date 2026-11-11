import type { Request, RequestHandler } from 'express'
import type { Pool } from 'pg'
import { findSessionUser } from './session.service.js'

export function sessionCookieSettings() {
  const production = process.env.NODE_ENV === 'production'
  return {
    name: production ? '__Host-quizzent_session' : 'quizzent_session',
    options: { httpOnly: true, secure: production, sameSite: 'lax' as const, path: '/' },
  }
}

export function readSessionToken(request: Request): string | undefined {
  const token: unknown = request.cookies?.[sessionCookieSettings().name]
  return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token) ? token : undefined
}

export const requireSameOriginRequest: RequestHandler = (request, response, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    && (request.get('X-Quizzent-Request') !== '1' || request.get('Sec-Fetch-Site') === 'cross-site')) {
    // This custom header requires a CORS preflight from another origin. CORS stays disabled.
    response.status(403).json({ message: 'This request must come from Quizzent.' })
    return
  }
  next()
}

export function requireSession(database: Pool): RequestHandler {
  return async (request, response, next) => {
    const token = readSessionToken(request)
    const user = token ? await findSessionUser(database, token) : null
    if (!user) { response.status(401).json({ message: 'Please log in to continue.' }); return }
    response.locals.user = user
    next()
  }
}
