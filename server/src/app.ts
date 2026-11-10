import express from 'express'

export const app = express()

app.disable('x-powered-by')

// This checks that the API is reachable, not that a database is connected.
app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'quizzent-api' })
})

app.use((_request, response) => {
  response.status(404).json({ message: 'Route not found' })
})
