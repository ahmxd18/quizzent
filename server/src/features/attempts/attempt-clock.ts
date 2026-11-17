import type { PoolClient } from 'pg'

export type AttemptProgress = {
  next_position: number
  total_questions: number
  issued_at: Date | null
  deadline_at: Date | null
}

export async function databaseNow(client: PoolClient): Promise<Date> {
  const { rows: [row] } = await client.query<{ now: Date }>(
    "SELECT date_trunc('milliseconds', clock_timestamp()) AS now",
  )
  return row.now
}

export function missedQuestionCount(deadline: Date, now: Date, limitMs: number, remaining: number) {
  const lateBy = now.getTime() - deadline.getTime()
  if (lateBy < 0) return 0
  return Math.min(remaining, Math.floor(lateBy / limitMs) + 1)
}

export async function moveAttempt(
  client: PoolClient, id: string, progress: AttemptProgress, nextPosition: number, issueMs: number, limitMs: number,
) {
  const complete = nextPosition > progress.total_questions
  const issued = complete ? null : new Date(issueMs)
  const deadline = complete ? null : new Date(issueMs + limitMs)
  await client.query(
    'UPDATE quiz_attempts SET next_position = $2, issued_at = $3, deadline_at = $4 WHERE participant_id = $1',
    [id, nextPosition, issued, deadline],
  )
  return { ...progress, next_position: nextPosition, issued_at: issued, deadline_at: deadline }
}

export async function reconcileTimeouts(client: PoolClient, id: string, progress: AttemptProgress, now: Date, limitMs: number) {
  const { next_position: current, total_questions: total, issued_at: issued, deadline_at: deadline } = progress
  if (!issued || !deadline) return progress
  const missed = missedQuestionCount(deadline, now, limitMs, total - current + 1)
  if (missed === 0) return progress
  const next = current + missed
  // Anchor later questions to the previous deadline. A late sweep never gives extra time.
  await client.query(
    `INSERT INTO quiz_answers (participant_id, question_id, issued_at, deadline_at, submitted_at)
     SELECT participant_id, question_id,
       $4::timestamptz + (position - $2::integer) * $5::integer * interval '1 millisecond',
       $4::timestamptz + (position - $2::integer + 1) * $5::integer * interval '1 millisecond',
       $4::timestamptz + (position - $2::integer + 1) * $5::integer * interval '1 millisecond'
     FROM quiz_attempt_questions WHERE participant_id = $1 AND position >= $2 AND position < $3`,
    [id, current, next, issued, limitMs],
  )
  return moveAttempt(client, id, progress, next, issued.getTime() + missed * limitMs, limitMs)
}
