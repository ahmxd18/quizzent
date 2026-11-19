import express from 'express'
import cookieParser from 'cookie-parser'
import type { Pool } from 'pg'
import { createSignupRouter } from './features/auth/signup.routes.js'
import { createSessionRouter } from './features/auth/session.routes.js'
import { errorHandler } from './middleware/error-handler.js'
import { createCompetitionRouter } from './features/competitions/competition.routes.js'
import { createRoomRouter } from './features/rooms/room.routes.js'
import { createGuestRouter, createRoomEntryRouter } from './features/rooms/guest.routes.js'
import { createAttemptRouter } from './features/attempts/attempt.routes.js'
import { createGuestResultsRouter } from './features/results/results.routes.js'
import { createAdminRouter } from './features/admin/admin.routes.js'
import type { RoomChanged } from './features/lobby/lobby.server.js'
import { apiHeaders } from './middleware/api-headers.js'

export function createApp(database: Pool, roomChanged?: RoomChanged) {
  const app = express()
  app.disable('x-powered-by')
  app.use(apiHeaders)
  app.use(cookieParser())

  // This checks the API process; PostgreSQL availability is checked separately.
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'quizzent-api' })
  })

  app.use('/api/auth', createSignupRouter(database))
  app.use('/api/auth', createSessionRouter(database))
  app.use('/api/competitions', createCompetitionRouter(database))
  app.use('/api/rooms', createRoomRouter(database, roomChanged))
  app.use('/api/admin', createAdminRouter(database, roomChanged))
  app.use('/api/guest/rooms', createAttemptRouter(database))
  app.use('/api/guest/rooms', createGuestResultsRouter(database))
  app.use('/api/guest', createGuestRouter(database))
  app.use('/api/room-entry', createRoomEntryRouter(database, roomChanged))
  app.use((_request, response) => {
    response.status(404).json({ message: 'Route not found' })
  })
  app.use(errorHandler)
  return app
}
