import express from 'express'
import type { Pool } from 'pg'
import { z } from 'zod'
import { requireSameOriginRequest, requireSession } from '../auth/session.http.js'
import type { SessionUser } from '../auth/session.service.js'
import { competitionSchema } from './competition.schema.js'
import { createCompetition, getCompetition, listCompetitions, updateCompetition } from './competition.service.js'
import { createQuestionRouter } from '../questions/question.routes.js'
import { publishCompetition } from './publication.service.js'

export function createCompetitionRouter(database: Pool) {
  const router = express.Router()
  router.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next() })
  router.use(requireSameOriginRequest, requireSession(database))
  router.use((request, response, next) => {
    if (['POST', 'PUT'].includes(request.method) && !request.is('application/json')) {
      response.status(415).json({ message: 'Send competition details as JSON.' }); return
    }
    next()
  }, express.json({ limit: '8kb' }))

  router.param('id', (_request, response, next, id: string) => {
    if (!z.uuid().safeParse(id).success) { response.status(400).json({ message: 'Invalid competition ID.' }); return }
    next()
  })
  router.use('/:id/questions', createQuestionRouter(database))
  router.post('/:id/publish', async (request, response) => {
    if (!z.strictObject({}).safeParse(request.body).success) {
      response.status(400).json({ message: 'Publishing does not accept competition changes. Send an empty JSON object.' }); return
    }
    const user: SessionUser = response.locals.user
    response.json({ competition: await publishCompetition(database, user.id, request.params.id) })
  })

  router.get('/', async (_request, response) => {
    const user: SessionUser = response.locals.user
    response.json({ competitions: await listCompetitions(database, user.id) })
  })
  router.get('/:id', async (request, response) => {
    const user: SessionUser = response.locals.user
    const competition = await getCompetition(database, user.id, request.params.id)
    if (!competition) { response.status(404).json({ message: 'Competition not found.' }); return }
    response.json({ competition })
  })

  const validate: express.RequestHandler = (request, response, next) => {
    const result = competitionSchema.safeParse(request.body)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !fieldErrors[field]) fieldErrors[field] = issue.message
      }
      response.status(400).json({ message: 'Check your competition details. Only title, description, and question time are accepted.', fieldErrors })
      return
    }
    response.locals.input = result.data
    next()
  }
  router.post('/', validate, async (_request, response) => {
    const user: SessionUser = response.locals.user
    const competition = await createCompetition(database, user.id, response.locals.input)
    response.status(201).json({ competition })
  })
  router.put('/:id', validate, async (request, response) => {
    const user: SessionUser = response.locals.user
    const competition = await updateCompetition(database, user.id, String(request.params.id), response.locals.input)
    // Missing and someone else's drafts deliberately have the same response.
    if (!competition) { response.status(404).json({ message: 'Competition not found.' }); return }
    response.json({ competition })
  })
  return router
}
