import { randomBytes } from 'node:crypto'
import { DatabaseError, type Pool } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { hashSecret } from '../../lib/secrets.js'
import { lockOwnedRoom } from './room.service.js'
import { RoomError } from './room.error.js'

export async function createInvitation(database: Pool, ownerId: string, roomId: string, reference: string) {
  try {
    return await inTransaction(database, async client => {
      await lockOwnedRoom(client, roomId, ownerId)
      const { rows: [count] } = await client.query('SELECT count(*)::integer AS total FROM room_invitations WHERE room_id = $1', [roomId])
      if (count.total >= 50) throw new RoomError(409, 'A room can have up to 50 personal invitations.')
      const token = randomBytes(32).toString('hex')
      const { rows: [invitation] } = await client.query('INSERT INTO room_invitations (room_id, reference, token_hash) VALUES ($1, $2, $3) RETURNING id, reference', [roomId, reference, hashSecret(token)])
      return { invitation, token }
    })
  } catch (error) {
    if (error instanceof DatabaseError && error.constraint === 'room_invitations_reference_unique') throw new RoomError(409, 'Use a different organiser reference; this one already exists in the room.')
    throw error
  }
}
export async function renewInvitation(database: Pool, ownerId: string, roomId: string, invitationId: string) {
  return inTransaction(database, async client => {
    await lockOwnedRoom(client, roomId, ownerId)
    const { rows: [invitation] } = await client.query('SELECT i.id, i.reference, p.id AS participant_id FROM room_invitations i LEFT JOIN room_participants p ON p.invitation_id = i.id WHERE i.id = $1 AND i.room_id = $2', [invitationId, roomId])
    if (!invitation) throw new RoomError(404, 'Invitation not found.')
    if (invitation.participant_id) throw new RoomError(409, 'This invitation has already been used. Its participant identity cannot be reassigned.')
    const token = randomBytes(32).toString('hex')
    await client.query('UPDATE room_invitations SET token_hash = $1 WHERE id = $2', [hashSecret(token), invitationId])
    return { invitation: { id: invitation.id, reference: invitation.reference }, token }
  })
}

