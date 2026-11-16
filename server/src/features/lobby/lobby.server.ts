import type { Server as HttpServer } from 'node:http'
import type { Pool } from 'pg'
import { Server } from 'socket.io'
import { getLobbyAccess, type LobbyAccess } from './lobby-access.js'
import { LobbyPresence } from './presence.js'

type OnlineParticipant = { participantId: string; ready: boolean }
type Counts = { onlineCount: number; readyCount: number }
type LobbyState = Counts & ({ participants: OnlineParticipant[] } | { ready: boolean })
type ReadyReply = { ok: true } | { ok: false; message: string }
type ClientEvents = { 'lobby:ready': (ready: boolean, reply: (result: ReadyReply) => void) => void }
type ServerEvents = {
  'lobby:state': (state: LobbyState) => void
  'lobby:room-changed': () => void
}
type SocketData = { access: LobbyAccess }

const channel = (roomId: string) => `lobby:${roomId}`

export function attachLobby(server: HttpServer, database: Pool, reconnectGraceMs = 8_000) {
  const presence = new LobbyPresence(reconnectGraceMs)
  const io = new Server<ClientEvents, ServerEvents, Record<never, never>, SocketData>(server, {
    transports: ['websocket'],
    pingInterval: 5_000,
    pingTimeout: 5_000,
    maxHttpBufferSize: 4_096,
    allowRequest: (request, accept) => {
      const scheme = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      const { host, origin } = request.headers
      // Browsers send Origin on WebSocket upgrades. Only the Quizzent site may use these cookies.
      accept(null, !!host && origin === `${scheme}://${host}`)
    },
  })
  let stopping = false

  function publish(roomId: string) {
    const participants = presence.participants(roomId)
    const counts = {
      onlineCount: participants.length,
      readyCount: participants.filter(participant => participant.ready).length,
    }
    for (const id of io.sockets.adapter.rooms.get(channel(roomId)) ?? []) {
      const socket = io.sockets.sockets.get(id)
      if (!socket) continue
      const access = socket.data.access
      if (access.role === 'organiser') {
        socket.emit('lobby:state', { ...counts, participants })
      } else {
        const ready = participants.some(participant => participant.participantId === access.participantId && participant.ready)
        socket.emit('lobby:state', { ...counts, ready })
      }
    }
  }

  io.use(async (socket, next) => {
    try {
      const access = await getLobbyAccess(database, socket.handshake.auth, socket.request.headers.cookie)
      if (!access) return next(new Error('This session cannot open the live lobby.'))
      socket.data.access = access
      next()
    } catch {
      next(new Error('The live lobby is unavailable. Please try again.'))
    }
  })

  io.on('connection', socket => {
    const access = socket.data.access
    const { roomId } = access
    void socket.join(channel(roomId))
    if (access.role === 'guest') presence.connect(roomId, access.participantId, socket.id)
    publish(roomId)

    let checking = false
    socket.on('lobby:ready', async (ready, reply) => {
      if (typeof reply !== 'function') return
      if (access.role !== 'guest' || typeof ready !== 'boolean') {
        reply({ ok: false, message: 'Only a joined guest can change their readiness.' })
        return
      }
      if (checking) {
        reply({ ok: false, message: 'A readiness update is already in progress.' })
        return
      }
      checking = true
      try {
        const currentAccess = await getLobbyAccess(database, socket.handshake.auth, socket.request.headers.cookie)
        if (!currentAccess || !presence.setReady(roomId, access.participantId, socket.id, ready)) {
          reply({ ok: false, message: 'This session can no longer change its readiness.' })
          return
        }
        publish(roomId)
        reply({ ok: true })
      } catch {
        reply({ ok: false, message: 'Could not update readiness. Please try again.' })
      } finally {
        checking = false
      }
    })

    socket.on('disconnect', () => {
      if (stopping || access.role !== 'guest') return
      presence.disconnect(roomId, access.participantId, socket.id)
      publish(roomId)
    })
  })

  // A socket can outlive the cookie that opened it, for example after logout in another tab.
  let reviewing = false
  const reviewTimer = setInterval(async () => {
    if (reviewing) return
    reviewing = true
    await Promise.allSettled([...io.sockets.sockets.values()].map(async socket => {
      const access = await getLobbyAccess(database, socket.handshake.auth, socket.request.headers.cookie)
      if (!access) socket.disconnect()
    }))
    reviewing = false
  }, 20_000).unref()

  return {
    roomChanged(roomId: string, change: 'joined' | 'closed') {
      if (change === 'closed') {
        presence.clear(roomId)
        publish(roomId)
      }
      io.to(channel(roomId)).emit('lobby:room-changed')
    },
    close() {
      stopping = true
      clearInterval(reviewTimer)
      presence.clearAll()
      return io.close()
    },
  }
}

export type RoomChanged = ReturnType<typeof attachLobby>['roomChanged']
