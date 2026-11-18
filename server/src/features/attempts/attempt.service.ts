import type { Pool, PoolClient } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { RoomError } from '../rooms/room.error.js'
import { databaseNow, moveAttempt, reconcileTimeouts, type AttemptProgress } from './attempt-clock.js'

type Membership = {
  participant_id: string; admitted: boolean; started_at: Date | null
  status: 'open' | 'closed'; question_time_seconds: number
  results_published_at: Date | null
  cancellation_reason: string | null
}
type Question = { id: string; prompt: string; options: { id: string; text: string }[] }
export type AnswerInput = { questionId: string; optionId: string; requestId: string }

async function lockAttempt(client: PoolClient, roomId: string, guestId: string) {
  // Guests can answer in parallel. Room closure waits for in-flight attempts.
  const { rows: [member] } = await client.query<Membership>(
    `SELECT p.id AS participant_id, p.admitted, r.started_at, r.status, c.question_time_seconds, r.results_published_at, r.cancellation_reason
     FROM room_participants p JOIN rooms r ON r.id = p.room_id JOIN competitions c ON c.id = r.competition_id
     WHERE r.id = $1 AND p.guest_id = $2 FOR SHARE OF r`, [roomId, guestId],
  )
  if (!member) throw new RoomError(404, 'You have not joined this room in this browser.')
  if (member.cancellation_reason) throw new RoomError(409, 'This competition was cancelled.')
  if (member.status === 'closed' && !member.results_published_at) throw new RoomError(409, 'This room is closed.')
  if (!member.started_at) throw new RoomError(409, 'This competition has not started.')
  if (!member.admitted) throw new RoomError(403, 'You were not admitted to this competition.')

  const id = member.participant_id
  const { rows: [progress] } = await client.query<AttemptProgress>(
    'SELECT next_position, total_questions, issued_at, deadline_at FROM quiz_attempts WHERE participant_id = $1 FOR UPDATE',
    [id],
  )
  if (!progress) throw new Error('Missing quiz attempt.')
  // Sample the database clock after locking so answers and timeouts share one decision point.
  const now = await databaseNow(client)
  return { id, progress, now, limitMs: member.question_time_seconds * 1000 }
}

async function viewAttempt(client: PoolClient, id: string, progress: AttemptProgress) {
  const { rows: [row] } = await client.query<{ timed_out: number; question: Question | null; server_now: Date }>(
    `SELECT clock_timestamp() AS server_now,
      (SELECT count(*)::integer FROM quiz_answers WHERE participant_id = a.participant_id AND request_id IS NULL) AS timed_out,
      CASE WHEN q.id IS NOT NULL THEN json_build_object(
        'id', q.id, 'prompt', q.prompt, 'options', (
          SELECT json_agg(json_build_object('id', o.id, 'text', o.text) ORDER BY display.position)
          FROM unnest(aq.option_order) WITH ORDINALITY AS display(id, position)
          JOIN question_options o ON o.question_id = q.id AND o.id = display.id
        )
      ) END AS question
     FROM quiz_attempts a
     LEFT JOIN quiz_attempt_questions aq ON aq.participant_id = a.participant_id AND aq.position = a.next_position
     LEFT JOIN questions q ON q.id = aq.question_id
     WHERE a.participant_id = $1`, [id],
  )
  const total = progress.total_questions
  const resolved = progress.next_position - 1
  const counts = { answered: resolved - row.timed_out, timedOut: row.timed_out, total }
  if (resolved === total) return { phase: 'complete', ...counts } as const
  if (!row.question || !progress.issued_at || !progress.deadline_at) throw new Error('Missing timed question.')
  return {
    phase: 'question', ...counts, question: row.question,
    issuedAt: progress.issued_at, deadlineAt: progress.deadline_at, serverNow: row.server_now,
  } as const
}

export function readAttempt(database: Pool, roomId: string, guestId: string) {
  return inTransaction(database, async client => {
    const { id, progress, now, limitMs } = await lockAttempt(client, roomId, guestId)
    const current = await reconcileTimeouts(client, id, progress, now, limitMs)
    return viewAttempt(client, id, current)
  })
}

export async function submitAnswer(database: Pool, roomId: string, guestId: string, input: AnswerInput) {
  const result = await inTransaction(database, async client => {
    const { id, progress, now, limitMs } = await lockAttempt(client, roomId, guestId)
    const current = await reconcileTimeouts(client, id, progress, now, limitMs)
    const { rows: [previous] } = await client.query<{ question_id: string; option_id: string }>(
      'SELECT question_id, option_id FROM quiz_answers WHERE participant_id = $1 AND request_id = $2', [id, input.requestId],
    )
    if (previous) {
      if (previous.question_id !== input.questionId || previous.option_id !== input.optionId) {
        return { error: new RoomError(409, 'This submission ID is already used for another answer.') }
      }
      return { view: await viewAttempt(client, id, current) }
    }

    const { rows: [question] } = await client.query<{ question_id: string; option_order: string[] }>(
      'SELECT question_id, option_order FROM quiz_attempt_questions WHERE participant_id = $1 AND position = $2',
      [id, current.next_position],
    )
    if (!question || question.question_id !== input.questionId) {
      // Return the rejection after committing any timeouts the request discovered.
      return { error: new RoomError(409, 'This question is no longer current. Refresh your progress to continue.') }
    }
    if (!question.option_order.includes(input.optionId)) {
      return { error: new RoomError(400, 'Choose an option from the current question.') }
    }
    if (!current.issued_at || !current.deadline_at) throw new Error('Missing question deadline.')
    await client.query(
      `INSERT INTO quiz_answers (participant_id, question_id, option_id, request_id, submitted_at, issued_at, deadline_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, input.questionId, input.optionId, input.requestId, now, current.issued_at, current.deadline_at],
    )
    const next = await moveAttempt(client, id, current, current.next_position + 1, now.getTime(), limitMs)
    return { view: await viewAttempt(client, id, next) }
  })
  if (result.error) throw result.error
  return result.view
}

export function expireAttempt(database: Pool, roomId: string, guestId: string) {
  return inTransaction(database, async client => {
    const { id, progress, now, limitMs } = await lockAttempt(client, roomId, guestId)
    await reconcileTimeouts(client, id, progress, now, limitMs)
  })
}
