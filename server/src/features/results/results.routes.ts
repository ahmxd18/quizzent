import express from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { requireGuestSession } from '../rooms/guest-session.http.js'
import { noStore, validateId } from '../rooms/room.http.js'
import { readGuestResults } from './results.service.js'

export function createGuestResultsRouter(database: Pool) {
  const router = express.Router()
  router.param('id', validateId)
  // Give each session its own polling budget, even if guests share an IP.
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    keyGenerator: (_request, response) => response.locals.guestId as string,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many results requests. Please try again later.' },
  })
  router.get('/:id/results', noStore, requireGuestSession(database), limit, async (request, response) => {
    response.json(await readGuestResults(database, String(request.params.id), response.locals.guestId))
  })
  return router
}
