import { createServer } from 'node:http'
import { once } from 'node:events'
import type { Pool } from 'pg'
import { createApp } from './app.js'
import { attachLobby } from './features/lobby/lobby.server.js'
import { startTimeoutWorker } from './features/attempts/timeout-worker.js'
import { cancelInterruptedRooms } from './features/rooms/cancellation.service.js'

export function createQuizzentServer(database: Pool, reconnectGraceMs?: number, warningMs?: number) {
  let ready = false
  let stopping = false
  let startup: Promise<number> | undefined
  let shutdown: Promise<void> | undefined
  let timeoutWorker: ReturnType<typeof startTimeoutWorker> | undefined
  const app = createApp(database, (roomId, change) => lobby.roomChanged(roomId, change))
  const server = createServer((request, response) => {
    if (ready) return app(request, response)
    response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify({ message: 'Quizzent is starting. Please try again.' }))
  })
  const lobby = attachLobby(server, database, reconnectGraceMs, warningMs, () => ready, () => timeoutWorker?.wake())

  async function start(port: number) {
    // Bind first so a second copy on the same port cannot cancel games on the live server.
    const listening = once(server, 'listening')
    server.listen(port, '127.0.0.1')
    await listening
    if (stopping) return 0
    const cancelled = await cancelInterruptedRooms(database)
    if (!stopping) {
      timeoutWorker = startTimeoutWorker(database)
      ready = true
    }
    return cancelled
  }

  async function close() {
    await startup?.catch(() => {})
    await Promise.all([timeoutWorker?.stop(), lobby.close()])
  }
  return {
    server,
    start(port: number) { return startup ??= start(port) },
    close() {
      stopping = true
      ready = false
      return shutdown ??= close()
    },
  }
}
