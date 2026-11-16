import express from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { z } from 'zod'
import { requireSameOriginRequest } from '../auth/session.http.js'
import { joinRoomSchema, roomCodeSchema } from './room.schema.js'
import { getGuestRoom, joinRoom, previewRoom } from './admission.service.js'
import { createGuestSession, findGuest, guestCookieSettings, guestSessionLifetimeMs } from './guest-session.service.js'
import { emptyBody, jsonWrites, noStore, validateBody, validateId } from './room.http.js'

export function createGuestRouter(database: Pool) {
  const router = express.Router()
  router.use(noStore, requireSameOriginRequest)
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many guest requests. Please try again later.' } }))
  router.use(jsonWrites, express.json({ limit: '8kb' }))
  router.param('id', validateId)
  router.post('/session', emptyBody, async (request, response) => {
    if (!await findGuest(database, request)) {
      const session = await createGuestSession(database)
      const cookie = guestCookieSettings()
      response.cookie(cookie.name, session.token, { ...cookie.options, maxAge: guestSessionLifetimeMs })
    }
    response.json({ ready: true })
  })
  router.get('/rooms/:id', async (request, response) => {
    const guestId = await findGuest(database, request)
    if (!guestId) { response.status(401).json({ message: 'Your guest session is missing or expired. Use the original browser, or contact your organiser if you used a personal invitation.' }); return }
    response.json(await getGuestRoom(database, guestId, request.params.id))
  })
  return router
}

export function createRoomEntryRouter(database: Pool) {
  const router = express.Router()
  router.use(noStore, requireSameOriginRequest)
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many room requests. Please try again later.' } }))
  router.use(jsonWrites, express.json({ limit: '8kb' }))
  router.param('code', (request, response, next, code: string) => {
    const result = roomCodeSchema.safeParse(code)
    if (!result.success) { response.status(400).json({ message: 'Enter an eight-character room code.' }); return }
    response.locals.code = result.data
    next()
  })
  router.get('/:code', async (request, response) => response.json(await previewRoom(database, response.locals.code, await findGuest(database, request))))
  router.post('/:code/join', validateBody(joinRoomSchema), async (request, response) => {
    const guestId = await findGuest(database, request)
    if (!guestId) { response.status(401).json({ message: 'Start a guest session before joining.' }); return }
    const input: z.infer<typeof joinRoomSchema> = response.locals.input
    response.json(await joinRoom(database, response.locals.code, guestId, input.nickname, input.invitationToken))
  })
  return router
}
