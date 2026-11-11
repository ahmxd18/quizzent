import { createApp } from './app.js'
import { createDatabasePool } from './database.js'

const port = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.')
}

// Bind locally while we develop. Deployment settings will come later.
const database = createDatabasePool()
const server = createApp(database).listen(port, '127.0.0.1', () => {
  console.log(`Quizzent API listening at http://127.0.0.1:${port}`)
})

// Stop accepting requests before releasing the shared database connections.
function shutdown() {
  server.close(() => { void database.end() })
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
server.on('error', () => {
  console.error('The API could not start. Check whether its port is already in use.')
  process.exitCode = 1
  void database.end()
})
