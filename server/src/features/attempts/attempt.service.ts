import type { Pool, PoolClient } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { RoomError } from '../rooms/room.error.js'

type Membership = { participant_id: string; admitted: boolean; started_at: Date | null; status: 'open' | 'closed' }
type Question = { id: string; prompt: string; options: { id: string; text: string }[] }
type Progress = { next_position: number; total_questions: number }
export type AnswerInput = { questionId: string; optionId: string; requestId: string }

const membershipColumns = 'p.id AS participant_id, p.admitted, r.started_at, r.status'
const membershipFrom = 'FROM room_participants p JOIN rooms r ON r.id = p.room_id'
const membershipWhere = 'WHERE r.id = $1 AND p.guest_id = $2'

function requireStartedRoom(membership: Membership | undefined) {
  if (!membership) throw new RoomError(404, 'You have not joined this room in this browser.')
  if (membership.status === 'closed') throw new RoomError(409, 'This room is closed.')
  if (!membership.started_at) throw new RoomError(409, 'This competition has not started.')
  if (!membership.admitted) throw new RoomError(403, 'You were not admitted to this competition.')
}

export async function readAttempt(db: Pool | PoolClient, roomId: string, guestId: string) {
  // This single read pairs the current question with the same saved progress.
  const { rows: [row] } = await db.query<Membership & {
    next_position: number | null
    total_questions: number | null
    question: Question | null
  }>(`SELECT ${membershipColumns}, a.next_position, a.total_questions,
    CASE WHEN q.id IS NOT NULL THEN json_build_object(
      'id', q.id, 'prompt', q.prompt, 'options', (
        SELECT json_agg(json_build_object('id', o.id, 'text', o.text) ORDER BY display.position)
        FROM unnest(aq.option_order) WITH ORDINALITY AS display(id, position)
        JOIN question_options o ON o.question_id = q.id AND o.id = display.id
      )
    ) END AS question
    ${membershipFrom}
    LEFT JOIN quiz_attempts a ON a.participant_id = p.id
    LEFT JOIN quiz_attempt_questions aq ON aq.participant_id = a.participant_id AND aq.position = a.next_position
    LEFT JOIN questions q ON q.id = aq.question_id
    ${membershipWhere}`, [roomId, guestId])

  requireStartedRoom(row)
  if (row.next_position === null || row.total_questions === null) throw new Error('Missing quiz attempt.')
  const answered = row.next_position - 1
  const total = row.total_questions
  if (answered === total) return { phase: 'complete', answered, total } as const
  if (!row.question) throw new Error('Missing assigned question.')
  return { phase: 'question', answered, total, question: row.question } as const
}

export async function submitAnswer(database: Pool, roomId: string, guestId: string, input: AnswerInput) {
  return inTransaction(database, async client => {
    // Guests can answer in parallel. Closing the room waits for in-flight answers to finish.
    const { rows: [membership] } = await client.query<Membership>(
      `SELECT ${membershipColumns} ${membershipFrom} ${membershipWhere} FOR SHARE OF r`, [roomId, guestId],
    )
    requireStartedRoom(membership)
    const id = membership.participant_id

    // Lock just this attempt so competing submissions from two tabs see one current question.
    const { rows: [attempt] } = await client.query<Progress>(
      'SELECT next_position, total_questions FROM quiz_attempts WHERE participant_id = $1 FOR UPDATE', [id],
    )
    if (!attempt) throw new Error('Missing quiz attempt.')

    const { rows: [previous] } = await client.query<{ question_id: string; option_id: string }>(
      'SELECT question_id, option_id FROM quiz_answers WHERE participant_id = $1 AND request_id = $2',
      [id, input.requestId],
    )
    if (previous) {
      if (previous.question_id !== input.questionId || previous.option_id !== input.optionId) {
        throw new RoomError(409, 'This submission ID is already used for another answer.')
      }
      return readAttempt(client, roomId, guestId)
    }

    const { rows: [current] } = await client.query<{ question_id: string; option_order: string[] }>(
      'SELECT question_id, option_order FROM quiz_attempt_questions WHERE participant_id = $1 AND position = $2',
      [id, attempt.next_position],
    )
    if (!current || current.question_id !== input.questionId) {
      throw new RoomError(409, 'This question is no longer current. Refresh your progress to continue.')
    }
    if (!current.option_order.includes(input.optionId)) throw new RoomError(400, 'Choose an option from the current question.')

    await client.query(
      'INSERT INTO quiz_answers (participant_id, question_id, option_id, request_id) VALUES ($1, $2, $3, $4)',
      [id, input.questionId, input.optionId, input.requestId],
    )
    await client.query('UPDATE quiz_attempts SET next_position = next_position + 1 WHERE participant_id = $1', [id])
    return readAttempt(client, roomId, guestId)
  })
}
