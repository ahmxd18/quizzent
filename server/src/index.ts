import { app } from './app.js'

const port = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.')
}

// Bind locally while we develop. Deployment settings will come later.
app.listen(port, '127.0.0.1', () => {
  console.log(`Quizzent API listening at http://127.0.0.1:${port}`)
})
