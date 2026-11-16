import { createServer } from 'node:http'
import type { Pool } from 'pg'
import { createApp } from './app.js'
import { attachLobby } from './features/lobby/lobby.server.js'

export function createQuizzentServer(database: Pool, reconnectGraceMs?: number, warningMs?: number) {
  const server = createServer(createApp(database, (roomId, change) => lobby.roomChanged(roomId, change)))
  const lobby = attachLobby(server, database, reconnectGraceMs, warningMs)
  return { server, close: lobby.close }
}
