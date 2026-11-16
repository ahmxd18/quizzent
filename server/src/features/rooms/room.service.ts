import { randomInt } from 'node:crypto'
import { DatabaseError, type Pool, type PoolClient } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { RoomError } from './room.error.js'
import { roomColumns, type Room } from './room.queries.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export async function lockOwnedRoom(client: PoolClient, roomId: string, ownerId: string) {
  const { rows: [room] } = await client.query<{ status: Room['status']; started_at: Date | null }>(
    'SELECT status, started_at FROM rooms WHERE id = $1 AND organiser_id = $2 FOR UPDATE', [roomId, ownerId],
  )
  if (!room) throw new RoomError(404, 'Room not found.')
  if (room.status !== 'open') throw new RoomError(409, 'This room is closed.')
  return room
}

export async function lockOwnedLobby(client: PoolClient, roomId: string, ownerId: string) {
  const room = await lockOwnedRoom(client, roomId, ownerId)
  if (room.started_at) throw new RoomError(409, 'This competition has already started.')
}

export async function listRooms(database: Pool, ownerId: string) {
  const { rows } = await database.query<Room>(`SELECT ${roomColumns} FROM rooms r JOIN competitions c ON c.id = r.competition_id WHERE r.organiser_id = $1 ORDER BY r.created_at DESC, r.id DESC`, [ownerId])
  return rows
}
export async function getOwnedRoom(database: Pool, ownerId: string, roomId: string) {
  const { rows: [room] } = await database.query<Room>(`SELECT ${roomColumns} FROM rooms r JOIN competitions c ON c.id = r.competition_id WHERE r.id = $1 AND r.organiser_id = $2`, [roomId, ownerId])
  if (!room) throw new RoomError(404, 'Room not found.')
  const { rows: participants } = await database.query(`SELECT p.id, p.participant_number AS "participantNumber", p.nickname, p.joined_at AS "joinedAt", p.admitted, i.reference AS "organiserReference" FROM room_participants p LEFT JOIN room_invitations i ON i.id = p.invitation_id WHERE p.room_id = $1 ORDER BY p.participant_number`, [roomId])
  const { rows: invitations } = await database.query(`SELECT i.id, i.reference, i.created_at AS "createdAt", p.id AS "participantId" FROM room_invitations i LEFT JOIN room_participants p ON p.invitation_id = i.id WHERE i.room_id = $1 ORDER BY i.created_at, i.id`, [roomId])
  return { room, participants, invitations }
}
export async function createRoom(database: Pool, ownerId: string, competitionId: string, admissionMode: 'open' | 'invitation', rules = { lobbySeconds: 60, minReady: 2 }) {
  try {
    const id = await inTransaction(database, async client => {
      const { rows: [competition] } = await client.query('SELECT status FROM competitions WHERE id = $1 AND organiser_id = $2 FOR UPDATE', [competitionId, ownerId])
      if (!competition) throw new RoomError(404, 'Competition not found.')
      if (competition.status !== 'published') throw new RoomError(409, 'Publish the competition before opening a room.')
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('')
        const lobbyEndsAt = new Date(Date.now() + rules.lobbySeconds * 1000)
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO rooms (competition_id, organiser_id, code, admission_mode, min_ready, lobby_ends_at)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (code) DO NOTHING RETURNING id`,
          [competitionId, ownerId, code, admissionMode, rules.minReady, lobbyEndsAt],
        )
        if (rows[0]) return rows[0].id
      }
      throw new RoomError(503, 'Could not create a room code. Please try again.')
    })
    return (await getOwnedRoom(database, ownerId, id)).room
  } catch (error) {
    if (error instanceof DatabaseError && error.constraint === 'rooms_one_open_per_organiser') throw new RoomError(409, 'You already have an open room. Close it before opening another.')
    throw error
  }
}
export async function closeRoom(database: Pool, ownerId: string, roomId: string) {
  await inTransaction(database, async client => {
    await lockOwnedRoom(client, roomId, ownerId)
    await client.query("UPDATE rooms SET status = 'closed', closed_at = clock_timestamp(), warning_ends_at = NULL WHERE id = $1", [roomId])
  })
}
