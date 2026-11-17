import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import { findGuest } from './guest-session.service.js'

export function requireGuestSession(database: Pool): RequestHandler {
  return async (request, response, next) => {
    const guestId = await findGuest(database, request)
    if (!guestId) {
      response.status(401).json({ message: 'Your guest session is missing or expired. Use the original browser to continue.' })
      return
    }
    response.locals.guestId = guestId
    next()
  }
}
