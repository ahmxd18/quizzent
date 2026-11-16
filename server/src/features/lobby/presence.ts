type ParticipantPresence = {
  sockets: Set<string>
  ready: boolean
  expiry?: NodeJS.Timeout
}

export class LobbyPresence {
  private readonly rooms = new Map<string, Map<string, ParticipantPresence>>()

  constructor(private readonly reconnectGraceMs: number) {}

  connect(roomId: string, participantId: string, socketId: string) {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = new Map()
      this.rooms.set(roomId, room)
    }
    const presence = room.get(participantId) ?? { sockets: new Set<string>(), ready: false }
    clearTimeout(presence.expiry)
    presence.expiry = undefined
    presence.sockets.add(socketId)
    room.set(participantId, presence)
  }

  disconnect(roomId: string, participantId: string, socketId: string) {
    const room = this.rooms.get(roomId)
    const presence = room?.get(participantId)
    if (!room || !presence?.sockets.delete(socketId) || presence.sockets.size > 0) return

    // Keep the choice briefly, but exclude the guest from every count while offline.
    presence.expiry = setTimeout(() => {
      room.delete(participantId)
      if (room.size === 0) this.rooms.delete(roomId)
    }, this.reconnectGraceMs).unref()
  }

  setReady(roomId: string, participantId: string, socketId: string, ready: boolean) {
    const presence = this.rooms.get(roomId)?.get(participantId)
    if (!presence?.sockets.has(socketId)) return false
    presence.ready = ready
    return true
  }

  participants(roomId: string) {
    const room = this.rooms.get(roomId)
    if (!room) return []

    return [...room].flatMap(([participantId, presence]) => presence.sockets.size > 0
      ? [{ participantId, ready: presence.ready }]
      : [])
  }

  clear(roomId: string) {
    for (const entry of this.rooms.get(roomId)?.values() ?? []) clearTimeout(entry.expiry)
    this.rooms.delete(roomId)
  }

  clearAll() {
    for (const roomId of this.rooms.keys()) this.clear(roomId)
  }
}
