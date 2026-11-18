import type { Pool } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { lockOwnedRoom } from './room.service.js'

export async function cancelRoom(database: Pool, ownerId: string, roomId: string, reason: string) {
  await inTransaction(database, async client => {
    // Answers and publication use the same room lock. Whichever commits first decides the outcome.
    await lockOwnedRoom(client, roomId, ownerId)
    await client.query(
      `UPDATE rooms SET status = 'closed', closed_at = clock_timestamp(), warning_ends_at = NULL,
        cancellation_reason = 'organiser', cancellation_note = $2 WHERE id = $1`,
      [roomId, reason],
    )
  })
}

export async function cancelInterruptedRooms(database: Pool) {
  // A single server owns running games. Any still open at startup came from a prior process.
  const result = await database.query(
    `UPDATE rooms SET status = 'closed', closed_at = clock_timestamp(), warning_ends_at = NULL,
       cancellation_reason = 'server_outage'
     WHERE status = 'open' AND started_at IS NOT NULL`,
  )
  return result.rowCount ?? 0
}
