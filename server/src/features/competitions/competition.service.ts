import type { Pool } from 'pg'
import type { CompetitionInput } from './competition.schema.js'

type Competition = CompetitionInput & { id: string; status: 'draft'; createdAt: Date; updatedAt: Date }
const columns = 'id, title, description, question_time_seconds AS "questionTimeSeconds", status, created_at AS "createdAt", updated_at AS "updatedAt"'

export async function listCompetitions(database: Pool, organiserId: string) {
  const { rows } = await database.query<Competition>(
    `SELECT ${columns} FROM competitions WHERE organiser_id = $1 ORDER BY updated_at DESC, id DESC`, [organiserId])
  return rows
}

export async function getCompetition(database: Pool, organiserId: string, id: string) {
  const { rows } = await database.query<Competition>(
    `SELECT ${columns} FROM competitions WHERE id = $1 AND organiser_id = $2`, [id, organiserId])
  return rows[0] ?? null
}

export async function createCompetition(database: Pool, organiserId: string, input: CompetitionInput) {
  const { rows } = await database.query<Competition>(
    `INSERT INTO competitions (organiser_id, title, description, question_time_seconds)
     VALUES ($1, $2, $3, $4) RETURNING ${columns}`, [organiserId, input.title, input.description, input.questionTimeSeconds])
  return rows[0]
}

export async function updateCompetition(database: Pool, organiserId: string, id: string, input: CompetitionInput) {
  // Ownership is part of the write itself; a caller cannot update another account's draft.
  const { rows } = await database.query<Competition>(
    `UPDATE competitions SET title = $1, description = $2, question_time_seconds = $3, updated_at = clock_timestamp()
     WHERE id = $4 AND organiser_id = $5 AND status = 'draft' RETURNING ${columns}`,
    [input.title, input.description, input.questionTimeSeconds, id, organiserId])
  return rows[0] ?? null
}
