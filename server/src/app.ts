import express from 'express'
import cookieParser from 'cookie-parser'
import type { Pool } from 'pg'
import { createSignupRouter } from './features/auth/signup.routes.js'
import { createSessionRouter } from './features/auth/session.routes.js'
import { errorHandler } from './middleware/error-handler.js'
import { createCompetitionRouter } from './features/competitions/competition.routes.js'

export function createApp(database: Pool) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cookieParser())

  // This checks the API process; PostgreSQL availability is checked separately.
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'quizzent-api' })
  })

  app.use('/api/auth', createSignupRouter(database))
  app.use('/api/auth', createSessionRouter(database))
  app.use('/api/competitions', createCompetitionRouter(database))
  app.use((_request, response) => {
    response.status(404).json({ message: 'Route not found' })
  })
  app.use(errorHandler)
  return app
}
