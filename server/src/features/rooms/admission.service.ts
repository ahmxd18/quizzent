import { DatabaseError, type Pool } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { hashSecret } from '../../lib/secrets.js'
import { suggestNickname } from './guest-names.js'
import { RoomError } from './room.error.js'
import { roomColumns, type Room } from './room.queries.js'

export async function previewRoom(database: Pool, code: string, guestId: string | null) {
  const { rows: [room] } = await database.query<Room>(`SELECT ${roomColumns} FROM rooms r JOIN competitions c ON c.id = r.competition_id WHERE r.code = $1`, [code])
  if (!room) throw new RoomError(404, 'Room not found. Check the code with your organiser.')
  const { rows: names } = await database.query<{ nickname: string }>('SELECT nickname FROM room_participants WHERE room_id = $1', [room.id])
  const { rows: existing } = guestId ? await database.query('SELECT id FROM room_participants WHERE room_id = $1 AND guest_id = $2', [room.id, guestId]) : { rows: [] }
  return { room, suggestedNickname: suggestNickname(names.map(row => row.nickname)), participantId: existing[0]?.id ?? null }
}
export async function joinRoom(database: Pool, code: string, guestId: string, nickname: string, invitationToken?: string) {
  try {
    return await inTransaction(database, async client => {
      // Admissions and closing share this lock; count, invitation claim, and insert are atomic.
      const { rows: [room] } = await client.query('SELECT id, status, admission_mode FROM rooms WHERE code = $1 FOR UPDATE', [code])
      if (!room) throw new RoomError(404, 'Room not found.')
      const { rows: [invitation] } = invitationToken ? await client.query('SELECT id FROM room_invitations WHERE room_id = $1 AND token_hash = $2', [room.id, hashSecret(invitationToken)]) : { rows: [] }
      if (invitationToken && !invitation) throw new RoomError(403, 'This invitation is invalid or has been replaced. Ask your organiser for a new link.')
      const { rows: [existing] } = await client.query('SELECT id, invitation_id FROM room_participants WHERE room_id = $1 AND guest_id = $2', [room.id, guestId])
      if (existing) {
        if (invitation && invitation.id !== existing.invitation_id) throw new RoomError(409, 'This browser has already joined this room as another participant.')
        return { roomId: room.id, participantId: existing.id }
      }
      if (room.status !== 'open') throw new RoomError(409, 'This room is closed to new guests.')
      if (room.admission_mode === 'invitation' && !invitation) throw new RoomError(403, 'This room requires your personal invitation link.')
      if (invitation && (await client.query('SELECT id FROM room_participants WHERE invitation_id = $1', [invitation.id])).rowCount) throw new RoomError(409, 'This invitation has already been used. Return in the original browser or contact your organiser.')
      const { rows: [count] } = await client.query('SELECT count(*)::integer AS total, coalesce(max(participant_number), 0)::integer AS last FROM room_participants WHERE room_id = $1', [room.id])
      if (count.total >= 50) throw new RoomError(409, 'This room is full (50 participants).')
      const { rows: [participant] } = await client.query('INSERT INTO room_participants (room_id, guest_id, invitation_id, participant_number, nickname) VALUES ($1, $2, $3, $4, $5) RETURNING id', [room.id, guestId, invitation?.id ?? null, count.last + 1, nickname])
      return { roomId: room.id, participantId: participant.id }
    })
  } catch (error) {
    if (error instanceof DatabaseError && error.constraint === 'room_participants_nickname_unique') throw new RoomError(409, 'That nickname is already taken in this room. Choose another one.')
    throw error
  }
}
export async function getGuestRoom(database: Pool, guestId: string, roomId: string) {
  const { rows: [participant] } = await database.query('SELECT id, nickname, participant_number AS "participantNumber" FROM room_participants WHERE room_id = $1 AND guest_id = $2', [roomId, guestId])
  if (!participant) throw new RoomError(404, 'You have not joined this room in this browser.')
  const { rows: [room] } = await database.query<Room>(`SELECT ${roomColumns} FROM rooms r JOIN competitions c ON c.id = r.competition_id WHERE r.id = $1`, [roomId])
  return { room, participant }
}
