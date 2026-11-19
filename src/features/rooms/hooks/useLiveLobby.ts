import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { notify } from '../../../lib/notifications'

type OnlineParticipant = { participantId: string; ready: boolean }
type Counts = { onlineCount: number; readyCount: number; serverNow: number }
type LobbyState = Counts & ({ participants: OnlineParticipant[] } | { ready: boolean })
type ReadyReply = { ok: true } | { ok: false; message: string }
type ServerEvents = { 'lobby:state': (state: LobbyState) => void; 'lobby:room-changed': () => void }
type ClientEvents = { 'lobby:ready': (ready: boolean, reply: (result: ReadyReply) => void) => void }
type LobbySocket = Socket<ServerEvents, ClientEvents>
export type LobbyConnection = 'connecting' | 'live' | 'reconnecting' | 'unavailable'

export function useLiveLobby(roomId: string, role: 'organiser' | 'guest', enabled: boolean) {
  const client = useQueryClient()
  const socketRef = useRef<LobbySocket | null>(null)
  const [connection, setConnection] = useState<LobbyConnection>('connecting')
  const [state, setState] = useState<LobbyState>()
  const [clockOffset, setClockOffset] = useState(0)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const socket: LobbySocket = io({ autoConnect: false, transports: ['websocket'], auth: { roomId, role } })
    socketRef.current = socket

    function refreshRoom() {
      // HTTP still serves the private roster and saved room details.
      const queryKey = role === 'organiser' ? ['rooms', 'detail', roomId] : ['guest', 'room', roomId]
      void client.invalidateQueries({ queryKey })
      if (role === 'organiser') void client.invalidateQueries({ queryKey: ['rooms', 'list'] })
    }

    socket.on('connect', refreshRoom)
    socket.on('lobby:room-changed', refreshRoom)
    socket.on('lobby:state', snapshot => {
      setClockOffset(snapshot.serverNow - Date.now())
      setState(snapshot)
      setConnection('live')
    })
    socket.on('connect_error', () => {
      setConnection(socket.active ? 'reconnecting' : 'unavailable')
      if (!socket.active) refreshRoom()
    })
    socket.on('disconnect', () => {
      setConnection(socket.active ? 'reconnecting' : 'unavailable')
      setUpdating(false)
      if (!socket.active) refreshRoom()
    })
    socket.connect()

    return () => {
      socketRef.current = null
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [client, enabled, role, roomId])

  async function setReady(ready: boolean) {
    const socket = socketRef.current
    if (!socket?.connected || updating) return
    setUpdating(true)
    try {
      const result = await socket.timeout(4_000).emitWithAck('lobby:ready', ready)
      if (socketRef.current === socket && !result.ok) notify.error(result.message)
    } catch {
      if (socketRef.current === socket && socket.connected) notify.error('The server didn’t confirm the change. Please try again.')
    } finally {
      if (socketRef.current === socket) setUpdating(false)
    }
  }

  function reconnect() {
    setConnection('connecting')
    socketRef.current?.connect()
  }

  return { connection, state: enabled && connection === 'live' ? state : undefined, clockOffset, setReady, updating, reconnect }
}
