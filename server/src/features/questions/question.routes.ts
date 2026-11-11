import express from 'express'
import type { Pool } from 'pg'
import { z } from 'zod'
import { getCompetition } from '../competitions/competition.service.js'
import type { SessionUser } from '../auth/session.service.js'
import { questionSchema } from './question.schema.js'
import { deleteQuestion, listQuestions, saveQuestion } from './question.service.js'

// Mounted inside the authenticated competition router; parent ID and write guards are shared.
export function createQuestionRouter(database: Pool) {
  const router = express.Router({ mergeParams: true })
  router.param('questionId', (_request, response, next, id: string) => {
    if (!z.uuid().safeParse(id).success) { response.status(400).json({ message: 'Invalid question ID.' }); return }
    next()
  })
  router.get('/', async (request: express.Request, response) => {
    const user: SessionUser = response.locals.user
    const competitionId = String(request.params.id)
    if (!await getCompetition(database, user.id, competitionId)) { response.status(404).json({ message: 'Competition not found.' }); return }
    response.json({ questions: await listQuestions(database, competitionId) })
  })
  const validate: express.RequestHandler = (request, response, next) => {
    const result = questionSchema.safeParse(request.body)
    if (!result.success) {
      response.status(400).json({ message: result.error.issues[0]?.message ?? 'Check your question and options.' }); return
    }
    response.locals.question = result.data
    next()
  }
  router.post('/', validate, async (request: express.Request, response) => {
    const user: SessionUser = response.locals.user
    response.status(201).json({ question: await saveQuestion(database, user.id, String(request.params.id), response.locals.question) })
  })
  router.put('/:questionId', validate, async (request: express.Request, response) => {
    const user: SessionUser = response.locals.user
    response.json({ question: await saveQuestion(database, user.id, String(request.params.id), response.locals.question, String(request.params.questionId)) })
  })
  router.delete('/:questionId', async (request: express.Request, response) => {
    const user: SessionUser = response.locals.user
    await deleteQuestion(database, user.id, String(request.params.id), String(request.params.questionId))
    response.json({ message: 'Question removed.' })
  })
  return router
}
