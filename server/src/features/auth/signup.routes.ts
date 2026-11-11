import express from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { signupSchema } from './signup.schema.js'
import { createOrganiser, EmailInUseError } from './signup.service.js'

export function createSignupRouter(database: Pool) {
  const router = express.Router()
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many signup attempts. Please try again later.' },
  })

  router.post('/signup', limiter, (request, response, next) => {
    if (!request.is('application/json')) {
      response.status(415).json({ message: 'Send signup details as JSON.' })
      return
    }
    next()
  }, express.json({ limit: '8kb' }), async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    const result = signupSchema.safeParse(request.body)

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !fieldErrors[field]) fieldErrors[field] = issue.message
      }
      response.status(400).json({ message: 'Check your signup details. Only name, email, and password are accepted.', fieldErrors })
      return
    }

    try {
      const user = await createOrganiser(database, result.data)
      response.status(201).json({ user })
    } catch (error) {
      if (error instanceof EmailInUseError) {
        response.status(409).json({ message: 'An account with this email already exists.', fieldErrors: { email: 'This email is already registered.' } })
        return
      }
      throw error
    }
  })

  return router
}
