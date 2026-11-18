import type { Pool, PoolClient } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { lockOwnedRoom } from './room.service.js'
import { RoomError } from './room.error.js'

export async function writeRoomCancellation(client: PoolClient, roomId: string, source: 'organiser' | 'superadmin', reason: string) {
  // The row lock orders this write against answers and result publication.
  const updated = await client.query(
    `UPDATE rooms SET status = 'closed', closed_at = clock_timestamp(), warning_ends_at = NULL,
      cancellation_reason = $2, cancellation_note = $3 WHERE id = $1 AND status = 'open'`,
    [roomId, source, reason],
  )
  if (!updated.rowCount) throw new RoomError(409, 'This room is closed.')
}

export async function cancelRoom(database: Pool, ownerId: string, roomId: string, reason: string) {
  await inTransaction(database, async client => {
    await lockOwnedRoom(client, roomId, ownerId)
    await writeRoomCancellation(client, roomId, 'organiser', reason)
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
