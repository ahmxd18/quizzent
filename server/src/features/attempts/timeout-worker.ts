import type { Pool } from 'pg'
import { RoomError } from '../rooms/room.error.js'
import { expireAttempt } from './attempt.service.js'
import { publishFinishedRooms } from '../results/publish-results.js'

export function startTimeoutWorker(database: Pool) {
  let stopped = false
  let pending: Promise<void> | undefined
  let timer: NodeJS.Timeout | undefined
  let requested = false

  async function sweep() {
    const { rows } = await database.query<{ room_id: string; guest_id: string }>(
      `SELECT p.room_id, p.guest_id FROM quiz_attempts a
       JOIN room_participants p ON p.id = a.participant_id JOIN rooms r ON r.id = p.room_id
       WHERE a.deadline_at <= now() AND r.status = 'open'
       ORDER BY a.deadline_at LIMIT 50`,
    )
    for (const attempt of rows) {
      if (stopped) break
      try {
        await expireAttempt(database, attempt.room_id, attempt.guest_id)
      } catch (error) {
        if (!(error instanceof RoomError)) throw error
      }
    }
    if (stopped) return false
    await publishFinishedRooms(database)
    const { rows: [state] } = await database.query<{ active: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM rooms WHERE status = 'open' AND started_at IS NOT NULL) AS active",
    )
    return state.active
  }

  function run() {
    timer = undefined
    if (stopped) return
    requested = false
    pending = sweep()
      .then(active => { if (active) requested = true })
      .catch(() => { requested = true; console.error('Could not update timed attempts or final results.') })
      .finally(() => {
        pending = undefined
        if (requested && !stopped) timer = setTimeout(run, 500).unref()
      })
  }

  return {
    wake() {
      if (stopped) return
      requested = true
      // A committed lobby change wakes us. No idle queries keep a free database awake.
      if (!pending && !timer) timer = setTimeout(run, 0).unref()
    },
    async stop() {
      stopped = true
      clearTimeout(timer)
      await pending
    },
  }
}
