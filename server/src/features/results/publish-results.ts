import type { Pool, PoolClient } from 'pg'
import { inTransaction } from '../../lib/transaction.js'

const noUnfinishedAttempts = `NOT EXISTS (
  SELECT 1 FROM room_participants p LEFT JOIN quiz_attempts a ON a.participant_id = p.id
  WHERE p.room_id = r.id AND p.admitted AND (a.participant_id IS NULL OR a.next_position <= a.total_questions)
)`

export async function publishRoomResults(client: PoolClient, roomId: string) {
  // Answer transactions hold a shared room lock. Wait for them to finish before ranking.
  const room = await client.query(
    "SELECT id FROM rooms WHERE id = $1 AND status = 'open' AND started_at IS NOT NULL FOR UPDATE",
    [roomId],
  )
  if (!room.rowCount) return false

  const scored = await client.query(
    `WITH scores AS (
      SELECT p.id, a.total_questions, a.next_position,
        count(qa.question_id) AS resolved,
        count(*) FILTER (WHERE qa.option_id = q.correct_option_id) AS correct,
        CASE WHEN count(qa.issued_at) = count(qa.question_id)
          THEN round(extract(epoch FROM sum(qa.submitted_at - qa.issued_at)) * 1000)::integer
        END AS elapsed
      FROM room_participants p
      LEFT JOIN quiz_attempts a ON a.participant_id = p.id
      LEFT JOIN quiz_answers qa ON qa.participant_id = a.participant_id
      LEFT JOIN questions q ON q.id = qa.question_id
      WHERE p.room_id = $1 AND p.admitted
      GROUP BY p.id, a.total_questions, a.next_position
    )
    INSERT INTO quiz_results (participant_id, rank, correct_count, total_time_ms)
    SELECT id, rank() OVER (ORDER BY correct DESC, elapsed ASC NULLS LAST), correct, elapsed
    FROM scores
    WHERE NOT EXISTS (
      SELECT 1 FROM scores WHERE total_questions IS NULL OR next_position <= total_questions OR resolved <> total_questions
    )`, [roomId],
  )
  if (!scored.rowCount) return false

  // Results and the final room state become visible together.
  await client.query(
    `WITH stamp AS (SELECT clock_timestamp() AS finished)
     UPDATE rooms SET status = 'closed', closed_at = stamp.finished, results_published_at = stamp.finished
     FROM stamp WHERE id = $1`, [roomId],
  )
  return true
}

export async function publishFinishedRooms(database: Pool) {
  const { rows } = await database.query<{ id: string }>(
    `SELECT r.id FROM rooms r WHERE r.status = 'open' AND r.started_at IS NOT NULL
       AND EXISTS (SELECT 1 FROM room_participants p WHERE p.room_id = r.id AND p.admitted)
       AND ${noUnfinishedAttempts} ORDER BY r.started_at LIMIT 50`,
  )
  for (const { id } of rows) {
    await inTransaction(database, client => publishRoomResults(client, id))
  }
}
