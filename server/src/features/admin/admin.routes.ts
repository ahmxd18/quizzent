import express from 'express'
import type { Pool } from 'pg'
import { z } from 'zod'
import { readSessionToken, requireSameOriginRequest, requireSession } from '../auth/session.http.js'
import type { SessionUser } from '../auth/session.service.js'
import type { RoomChanged } from '../lobby/lobby.server.js'
import { noStore, validateBody } from '../rooms/room.http.js'
import { cancelRoomSchema } from '../rooms/room.schema.js'
import { cancelAdminRoom, changeAccount, inspectAdminOverview } from './admin.service.js'

const statusSchema = z.strictObject({ status: z.enum(['active', 'suspended']) })
const roleSchema = z.strictObject({ role: z.enum(['organiser', 'superadmin']) })
const searchSchema = z.string().trim().max(100).transform(value => value.toLowerCase())

export function createAdminRouter(database: Pool, roomChanged?: RoomChanged) {
  const router = express.Router()
  router.use(noStore, requireSameOriginRequest, requireSession(database), (_request, response, next) => {
    const user: SessionUser = response.locals.user
    if (user.role !== 'superadmin') {
      response.status(403).json({ message: 'Superadmin access is required.' })
      return
    }
    next()
  }, express.json({ limit: '4kb' }))

  router.param('id', (_request, response, next, value) => {
    if (!z.uuid().safeParse(value).success) { response.status(400).json({ message: 'Invalid record ID.' }); return }
    next()
  })
  router.get('/overview', async (request, response) => {
    const search = searchSchema.safeParse(request.query.q ?? '')
    if (!search.success) { response.status(400).json({ message: 'Use at most 100 characters for search.' }); return }
    response.json(await inspectAdminOverview(database, search.data))
  })
  router.put('/users/:id/status', validateBody(statusSchema), async (request, response) => {
    await changeAccount(database, readSessionToken(request), String(request.params.id).toLowerCase(), { field: 'status', value: response.locals.input.status })
    response.json({ message: 'Account status saved.' })
  })
  router.put('/users/:id/role', validateBody(roleSchema), async (request, response) => {
    await changeAccount(database, readSessionToken(request), String(request.params.id).toLowerCase(), { field: 'role', value: response.locals.input.role })
    response.json({ message: 'Account role saved.' })
  })
  router.post('/rooms/:id/cancel', validateBody(cancelRoomSchema), async (request, response) => {
    const roomId = String(request.params.id).toLowerCase()
    await cancelAdminRoom(database, readSessionToken(request), roomId, response.locals.input.reason)
    roomChanged?.(roomId, 'closed')
    response.json({ message: 'Competition cancelled.' })
  })
  return router
}
