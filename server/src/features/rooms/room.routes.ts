import { accountWriteLimit } from '../auth/account-write-limit.js'
import express from 'express'
import type { Pool } from 'pg'
import { z } from 'zod'
import { requireSameOriginRequest, requireSession } from '../auth/session.http.js'
import type { SessionUser } from '../auth/session.service.js'
import { cancelRoomSchema, createRoomSchema, invitationSchema } from './room.schema.js'
import { closeRoom, createRoom, getOwnedRoom, listRooms } from './room.service.js'
import { createInvitation, renewInvitation } from './invitation.service.js'
import { emptyBody, jsonWrites, noStore, validateBody, validateId } from './room.http.js'
import type { RoomChanged } from '../lobby/lobby.server.js'
import { readOrganiserProgress } from '../results/results.service.js'
import { cancelRoom } from './cancellation.service.js'
import { readHostingPolicy } from './hosting-policy.js'

export function createRoomRouter(database: Pool, roomChanged?: RoomChanged) {
  const router = express.Router()
  router.use(noStore, requireSameOriginRequest, requireSession(database), accountWriteLimit(), jsonWrites, express.json({ limit: '8kb' }))
  router.param('id', validateId)
  router.param('invitationId', validateId)
  router.get('/', async (_request, response) => {
    const user: SessionUser = response.locals.user
    const [rooms, hosting] = await Promise.all([listRooms(database, user.id), readHostingPolicy(database, user.id)])
    response.json({ rooms, hosting })
  })
  router.post('/', validateBody(createRoomSchema), async (_request, response) => {
    const user: SessionUser = response.locals.user
    const input: z.infer<typeof createRoomSchema> = response.locals.input
    response.status(201).json({ room: await createRoom(database, user.id, input.competitionId, input.admissionMode, input) })
  })
  router.get('/:id', async (request, response) => {
    const user: SessionUser = response.locals.user
    response.json(await getOwnedRoom(database, user.id, request.params.id))
  })
  router.get('/:id/progress', async (request, response) => {
    const user: SessionUser = response.locals.user
    response.json(await readOrganiserProgress(database, request.params.id, user.id))
  })
  router.post('/:id/close', emptyBody, async (request, response) => {
    const user: SessionUser = response.locals.user
    const roomId = String(request.params.id)
    await closeRoom(database, user.id, roomId)
    roomChanged?.(roomId, 'closed')
    response.json({ message: 'Room closed.' })
  })
  router.post('/:id/cancel', validateBody(cancelRoomSchema), async (request, response) => {
    const user: SessionUser = response.locals.user
    const roomId = String(request.params.id)
    await cancelRoom(database, user.id, roomId, response.locals.input.reason)
    roomChanged?.(roomId, 'closed')
    response.json({ message: 'Competition cancelled.' })
  })
  router.post('/:id/invitations', validateBody(invitationSchema), async (request, response) => {
    const user: SessionUser = response.locals.user
    response.status(201).json(await createInvitation(database, user.id, String(request.params.id), response.locals.input.reference))
  })
  router.post('/:id/invitations/:invitationId/link', emptyBody, async (request, response) => {
    const user: SessionUser = response.locals.user
    response.json(await renewInvitation(database, user.id, String(request.params.id), String(request.params.invitationId)))
  })
  return router
}

