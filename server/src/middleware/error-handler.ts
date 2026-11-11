import type { ErrorRequestHandler } from 'express'
import { CompetitionWriteError } from '../features/competitions/draft-transaction.js'

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }
  if (error instanceof CompetitionWriteError) { response.status(error.status).json({ message: error.message }); return }
  const errorType = typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined

  if (errorType === 'entity.parse.failed') {
    response.status(400).json({ message: 'The request contains invalid JSON.' })
    return
  }
  if (errorType === 'entity.too.large') {
    response.status(413).json({ message: 'The request is too large.' })
    return
  }

  // Do not log request bodies, passwords, connection strings, or database details.
  console.error('Request failed.', { method: request.method, path: request.path })
  response.status(500).json({ message: 'Something went wrong. Please try again later.' })
}
