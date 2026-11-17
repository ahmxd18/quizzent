import express from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { z } from 'zod'
import { requireSameOriginRequest } from '../auth/session.http.js'
import { findGuest } from '../rooms/guest-session.service.js'
import { jsonWrites, noStore, validateBody, validateId } from '../rooms/room.http.js'
import { readAttempt, submitAnswer, type AnswerInput } from './attempt.service.js'

const uuid = z.uuid().transform(value => value.toLowerCase())
const answerSchema = z.strictObject({ requestId: uuid, questionId: uuid, optionId: uuid })

export function createAttemptRouter(database: Pool) {
  const router = express.Router()
  router.param('id', validateId)
  const requireGuest: express.RequestHandler = async (request, response, next) => {
    const guestId = await findGuest(database, request)
    if (!guestId) {
      response.status(401).json({ message: 'Your guest session is missing or expired. Use the original browser to continue.' })
      return
    }
    response.locals.guestId = guestId
    next()
  }

  // A classroom can share one IP address. Give each guest session its own request budget.
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    keyGenerator: (_request, response) => response.locals.guestId as string,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many attempt requests. Please try again later.' },
  })

  router.use('/:id/attempt', noStore, requireSameOriginRequest, requireGuest, limit, jsonWrites, express.json({ limit: '4kb' }))
  router.get('/:id/attempt', async (request, response) => {
    response.json(await readAttempt(database, request.params.id, response.locals.guestId))
  })
  router.post('/:id/attempt/answers', validateBody(answerSchema), async (request, response) => {
    const input: AnswerInput = response.locals.input
    response.json(await submitAnswer(database, String(request.params.id), response.locals.guestId, input))
  })
  return router
}
