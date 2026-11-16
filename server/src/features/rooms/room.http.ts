import express from 'express'
import { z } from 'zod'

export function validateBody(schema: z.ZodType): express.RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.body)
    if (!result.success) { response.status(400).json({ message: result.error.issues[0]?.message ?? 'Check your room details.' }); return }
    response.locals.input = result.data
    next()
  }
}
export const emptyBody = validateBody(z.strictObject({}))
export const noStore: express.RequestHandler = (_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next() }
export const jsonWrites: express.RequestHandler = (request, response, next) => {
  if (request.method === 'POST' && !request.is('application/json')) { response.status(415).json({ message: 'Send room details as JSON.' }); return }
  next()
}
export const validateId: express.RequestParamHandler = (_request, response, next, value: string) => {
  if (!z.uuid().safeParse(value).success) { response.status(400).json({ message: 'Invalid room or invitation ID.' }); return }
  next()
}

