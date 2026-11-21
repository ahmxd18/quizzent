import { accountWriteLimit } from '../auth/account-write-limit.js'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { z } from 'zod'
import { readSessionToken, requireSameOriginRequest, requireSession } from '../auth/session.http.js'
import type { SessionUser } from '../auth/session.service.js'
import type { RoomChanged } from '../lobby/lobby.server.js'
import { noStore, validateBody } from '../rooms/room.http.js'
import { cancelRoomSchema } from '../rooms/room.schema.js'
import { cancelAdminRoom, changeAccount, inspectAdminOverview, setHostingPolicy } from './admin.service.js'
import { directoryFilters, readDirectory, readOrganiserOptions } from './directory.js'

const statusSchema = z.strictObject({ status: z.enum(['active', 'suspended']), password: z.string().min(1).max(128).optional() })
  .refine(value => value.status !== 'suspended' || !!value.password, { message: 'Enter your current password to suspend an account.' })
const roleSchema = z.strictObject({ role: z.enum(['organiser', 'superadmin']), password: z.string().min(1).max(128) })
const hostingSchema = z.strictObject({ restricted: z.boolean(), weeklyLimit: z.number().int().min(0).max(2147483647).nullable() })
const searchSchema = z.string().trim().max(100).transform(value => value.toLowerCase())

export function createAdminRouter(database: Pool, roomChanged?: RoomChanged) {
  const router = express.Router()
  router.use(noStore, requireSameOriginRequest, requireSession(database), accountWriteLimit(), (_request, response, next) => {
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
  router.get('/directory', async (request, response) => {
    const filters = directoryFilters.safeParse(request.query)
    if (!filters.success) {
      response.status(400).json({ message: filters.error.issues[0]?.message ?? 'Invalid directory filters.' })
      return
    }
    response.json(await readDirectory(database, filters.data))
  })
  router.get('/organisers', async (request, response) => {
    const filters = z.strictObject({
      search: z.string().trim().max(100).default(''),
      page: z.string().regex(/^[1-9][0-9]{0,4}$/).transform(Number).default(1),
    }).safeParse(request.query)
    if (!filters.success) { response.status(400).json({ message: 'Invalid organiser search.' }); return }
    response.json(await readOrganiserOptions(database, filters.data.search, filters.data.page))
  })
  const roleLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
    keyGenerator: (_request, response) => (response.locals.user as SessionUser).id,
    message: { message: 'Too many password verification attempts. Try again later.' },
  })
  router.put('/users/:id/status', validateBody(statusSchema), (request, response, next) => {
    if (response.locals.input.status === 'suspended') return roleLimit(request, response, next)
    next()
  }, async (request, response) => {
    await changeAccount(database, readSessionToken(request), String(request.params.id).toLowerCase(), {
      field: 'status', value: response.locals.input.status, password: response.locals.input.password,
    })
    response.json({ message: 'Account status saved.' })
  })
  router.put('/users/:id/role', validateBody(roleSchema), roleLimit, async (request, response) => {
    const { role, password } = response.locals.input as z.infer<typeof roleSchema>
    await changeAccount(database, readSessionToken(request), String(request.params.id).toLowerCase(), { field: 'role', value: role, password })
    response.json({ message: 'Account role saved.' })
  })
  router.put('/users/:id/hosting', validateBody(hostingSchema), async (request, response) => {
    await setHostingPolicy(database, readSessionToken(request), String(request.params.id).toLowerCase(), response.locals.input)
    response.json({ message: 'Hosting policy saved.' })
  })
  router.post('/rooms/:id/cancel', validateBody(cancelRoomSchema), async (request, response) => {
    const roomId = String(request.params.id).toLowerCase()
    await cancelAdminRoom(database, readSessionToken(request), roomId, response.locals.input.reason)
    roomChanged?.(roomId, 'closed')
    response.json({ message: 'Competition cancelled.' })
  })
  return router
}
