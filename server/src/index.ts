import { createDatabasePool } from './database.js'
import { createQuizzentServer } from './server.js'
import { readRuntimeConfig } from './runtime-config.js'

const { port, ...settings } = readRuntimeConfig()
const database = createDatabasePool()
const { start, close } = createQuizzentServer(database, undefined, undefined, settings)

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
    console.log(`Quizzent listening on ${settings.host}:${port}`)
  }
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code
  console.error(code === 'EADDRINUSE'
    ? 'The API port is already in use.'
    : 'The API could not recover rooms. Check PostgreSQL and run npm run db:migrate.')
  process.exitCode = 1
  await shutdown()
}
