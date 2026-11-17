import type { Pool } from 'pg'
import { RoomError } from '../rooms/room.error.js'
import { expireAttempt } from './attempt.service.js'

export function startTimeoutWorker(database: Pool) {
  let stopped = false
  let pending: Promise<void> | undefined

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
  }

  const timer = setInterval(() => {
    if (pending) return
    pending = sweep()
      .catch(() => { console.error('Could not reconcile expired quiz attempts.') })
      .finally(() => { pending = undefined })
  }, 500).unref()

  return async function stop() {
    stopped = true
    clearInterval(timer)
    await pending
  }
}
