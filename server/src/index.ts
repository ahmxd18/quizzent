import { createDatabasePool } from './database.js'
import { createQuizzentServer } from './server.js'

const port = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.')
}

// Bind locally while we develop. Deployment settings will come later.
const database = createDatabasePool()
const { server, close } = createQuizzentServer(database)
server.listen(port, '127.0.0.1', () => {
  console.log(`Quizzent API listening at http://127.0.0.1:${port}`)
})

// Stop accepting requests before releasing the shared database connections.
let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  void close().finally(() => database.end())
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
server.on('error', () => {
  console.error('The API could not start. Check whether its port is already in use.')
  process.exitCode = 1
  shutdown()
})
