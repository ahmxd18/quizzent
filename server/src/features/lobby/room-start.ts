import type { Pool } from 'pg'
import { inTransaction } from '../../lib/transaction.js'

type Schedule = {
  minimum: number
  eligible: boolean
  armedUntil: number | null
  timer?: NodeJS.Timeout
  running: boolean
  dirty: boolean
}

type RoomTiming = {
  status: 'open' | 'closed'
  lobby_ends_at: Date
  warning_ends_at: Date | null
  started_at: Date | null
}

export function createRoomStart(
  database: Pool,
  readyIds: (roomId: string) => string[],
  hasSubscribers: (roomId: string) => boolean,
  notify: (roomId: string) => void,
  warningMs = 5_000,
) {
  const schedules = new Map<string, Schedule>()

  function forget(roomId: string) {
    clearTimeout(schedules.get(roomId)?.timer)
    schedules.delete(roomId)
  }

  function schedule(roomId: string, entry: Schedule, at = Date.now()) {
    clearTimeout(entry.timer)
    if (entry.running) {
      entry.dirty = true
      return
    }
    entry.timer = setTimeout(() => { void check(roomId, entry) }, Math.max(0, at - Date.now())).unref()
  }

  async function check(roomId: string, entry: Schedule) {
    entry.running = true
    entry.dirty = false
    try {
      const outcome = await inTransaction(database, async client => {
        // Joins and manual closure take this same lock. Re-read live readiness once it is ours.
        const { rows: [room] } = await client.query<RoomTiming>(
          'SELECT status, lobby_ends_at, warning_ends_at, started_at FROM rooms WHERE id = $1 FOR UPDATE',
          [roomId],
        )
        if (!room || room.status !== 'open' || room.started_at || schedules.get(roomId) !== entry) {
          return { terminal: true }
        }
        const ids = readyIds(roomId)
        const now = Date.now()
        if (ids.length < entry.minimum) {
          if (!room.warning_ends_at) return {}
          await client.query('UPDATE rooms SET warning_ends_at = NULL WHERE id = $1', [roomId])
          return { changed: true }
        }

        const lobbyEnds = room.lobby_ends_at.getTime()
        if (now < lobbyEnds) return { next: lobbyEnds }

        let warningEnds = room.warning_ends_at?.getTime()
        // A restarted server or a dip below the minimum invalidates an earlier warning.
        if (warningEnds === undefined || warningEnds !== entry.armedUntil) {
          warningEnds = now + warningMs
          entry.armedUntil = warningEnds
          await client.query('UPDATE rooms SET warning_ends_at = $2 WHERE id = $1', [roomId, new Date(warningEnds)])
          return { changed: true, next: warningEnds }
        }
        if (now < warningEnds) return { next: warningEnds }

        // The lock makes this the decision point. Save the roster and start together.
        const admitted = await client.query(
          'UPDATE room_participants SET admitted = true WHERE room_id = $1 AND id = ANY($2::uuid[])', [roomId, ids],
        )
        if (admitted.rowCount !== ids.length) throw new Error('The ready roster changed before it could be saved.')
        await client.query(
          'UPDATE rooms SET started_at = $2, warning_ends_at = NULL WHERE id = $1', [roomId, new Date(now)],
        )
        return { changed: true, terminal: true }
      })

      entry.running = false
      if (schedules.get(roomId) !== entry) return
      if (outcome.changed) notify(roomId)
      if (outcome.terminal || !hasSubscribers(roomId)) forget(roomId)
      else if (entry.dirty) schedule(roomId, entry)
      else if (outcome.next !== undefined) schedule(roomId, entry, outcome.next)
    } catch {
      entry.running = false
      if (schedules.get(roomId) !== entry) return
      // A failed database write leaves admission unchanged. Try again when it is reachable.
      schedule(roomId, entry, Date.now() + 1_000)
    }
  }

  return {
    watch(roomId: string, minimum: number) {
      if (schedules.has(roomId)) return
      const entry = { minimum, eligible: false, armedUntil: null, running: false, dirty: false }
      schedules.set(roomId, entry)
      schedule(roomId, entry)
    },
    observe(roomId: string, readyCount: number) {
      const entry = schedules.get(roomId)
      if (!entry) return
      const eligible = readyCount >= entry.minimum
      if (eligible === entry.eligible && hasSubscribers(roomId)) return
      entry.eligible = eligible
      if (!eligible) entry.armedUntil = null
      schedule(roomId, entry)
    },
    forget,
    stop() {
      for (const roomId of schedules.keys()) forget(roomId)
    },
  }
}
