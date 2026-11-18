import type { Pool } from 'pg'
import { RoomError } from '../rooms/room.error.js'

type RoomState = { status: 'open' | 'closed'; started_at: Date | null; results_published_at: Date | null }

async function readStandings(database: Pool, roomId: string) {
  const { rows } = await database.query(
    `SELECT result.rank, p.participant_number AS "participantNumber", p.nickname,
       result.correct_count AS correct, result.total_time_ms AS "totalTimeMs",
       a.total_questions AS total
     FROM quiz_results result
     JOIN quiz_attempts a ON a.participant_id = result.participant_id
     JOIN room_participants p ON p.id = result.participant_id
     WHERE p.room_id = $1 ORDER BY result.rank, p.participant_number`, [roomId],
  )
  return rows
}

export async function readOrganiserProgress(database: Pool, roomId: string, ownerId: string) {
  const { rows: [room] } = await database.query<RoomState>(
    'SELECT status, started_at, results_published_at FROM rooms WHERE id = $1 AND organiser_id = $2', [roomId, ownerId],
  )
  if (!room) throw new RoomError(404, 'Room not found.')
  if (room.results_published_at) {
    return { phase: 'final', publishedAt: room.results_published_at, standings: await readStandings(database, roomId) }
  }
  if (!room.started_at) return { phase: room.status === 'closed' ? 'closed' : 'lobby' }
  const { rows: participants } = await database.query(
    `SELECT p.id AS "participantId", a.total_questions AS total,
       (a.next_position - 1)::integer AS resolved,
       (SELECT count(*)::integer FROM quiz_answers qa WHERE qa.participant_id = a.participant_id AND qa.request_id IS NULL) AS "timedOut"
     FROM room_participants p JOIN quiz_attempts a ON a.participant_id = p.id
     WHERE p.room_id = $1 AND p.admitted ORDER BY p.participant_number`, [roomId],
  )
  return { phase: room.status === 'closed' ? 'closed' : 'running', participants }
}

export async function readGuestResults(database: Pool, roomId: string, guestId: string) {
  const { rows: [member] } = await database.query<RoomState & { id: string; admitted: boolean; participant_number: number }>(
    `SELECT p.id, p.admitted, p.participant_number, r.status, r.started_at, r.results_published_at
     FROM room_participants p JOIN rooms r ON r.id = p.room_id WHERE r.id = $1 AND p.guest_id = $2`,
    [roomId, guestId],
  )
  if (!member) throw new RoomError(404, 'You have not joined this room in this browser.')
  if (!member.admitted) throw new RoomError(403, 'You were not admitted to this competition.')
  if (!member.results_published_at) return { phase: member.status === 'closed' ? 'closed' : 'waiting' }

  const standings = await readStandings(database, roomId)
  // Only the signed-in guest's own choices are returned after publication.
  const { rows: review } = await database.query(
    `SELECT aq.position, q.prompt, chosen.text AS "selectedOption", correct.text AS "correctOption",
       CASE WHEN qa.option_id IS NULL THEN 'timeout'
            WHEN qa.option_id = q.correct_option_id THEN 'correct' ELSE 'incorrect' END AS outcome
     FROM quiz_attempt_questions aq JOIN questions q ON q.id = aq.question_id
     JOIN quiz_answers qa ON qa.participant_id = aq.participant_id AND qa.question_id = aq.question_id
     JOIN question_options correct ON correct.question_id = q.id AND correct.id = q.correct_option_id
     LEFT JOIN question_options chosen ON chosen.question_id = q.id AND chosen.id = qa.option_id
     WHERE aq.participant_id = $1 ORDER BY aq.position`, [member.id],
  )
  return {
    phase: 'final', publishedAt: member.results_published_at,
    participantNumber: member.participant_number, standings, review,
  }
}
