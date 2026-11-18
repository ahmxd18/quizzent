import { createDatabasePool } from './database.js'
import { createQuizzentServer } from './server.js'

const port = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.')
}

// Bind locally while we develop. Deployment settings will come later.
const database = createDatabasePool()
const { start, close } = createQuizzentServer(database)

// Stop accepting requests before releasing the shared database connections.
let stopping: Promise<void> | undefined
function shutdown() {
  return stopping ??= close().finally(() => database.end())
}
process.once('SIGINT', () => { void shutdown() })
process.once('SIGTERM', () => { void shutdown() })

try {
  const cancelled = await start(port)
  if (!stopping) {
    if (cancelled > 0) console.log(`Cancelled ${cancelled} interrupted competition(s).`)
    console.log(`Quizzent API listening at http://127.0.0.1:${port}`)
  }
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code
  console.error(code === 'EADDRINUSE'
    ? 'The API port is already in use.'
    : 'The API could not recover rooms. Check PostgreSQL and run npm run db:migrate.')
  process.exitCode = 1
  await shutdown()
}
