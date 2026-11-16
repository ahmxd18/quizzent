import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { CompetitionWriteError, withDraft } from '../competitions/draft-transaction.js'
import type { QuestionInput } from './question.schema.js'

export type Question = { id: string; prompt: string; position: number; correctOptionId: string; options: { id: string; text: string }[] }

export async function listQuestions(database: Pool | PoolClient, competitionId: string) {
  const { rows } = await database.query<Question>(
    `SELECT q.id, q.prompt, q.position, q.correct_option_id AS "correctOptionId",
     jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text) ORDER BY o.position) AS options
     FROM questions q JOIN question_options o ON o.question_id = q.id
     WHERE q.competition_id = $1 GROUP BY q.id ORDER BY q.position`, [competitionId])
  return rows
}

export async function saveQuestion(database: Pool, ownerId: string, competitionId: string, input: QuestionInput, questionId?: string) {
  return withDraft(database, ownerId, competitionId, async client => {
    const existing = await listQuestions(client, competitionId)
    const previous = questionId ? existing.find(question => question.id === questionId) : undefined
    if (questionId && !previous) throw new CompetitionWriteError(404, 'Question not found.')
    if (!questionId && existing.length >= 100) throw new CompetitionWriteError(409, 'A competition can have up to 100 questions.')
    const id = previous?.id ?? randomUUID()
    // Option positions stay fixed during editing, preserving their IDs for future attempts.
    const options = input.options.map((text, index) => ({ id: previous?.options[index].id ?? randomUUID(), text }))
    if (previous) {
      await client.query('UPDATE questions SET prompt = $1, correct_option_id = $2 WHERE id = $3', [input.prompt, options[input.correctOptionIndex].id, id])
      for (const option of options) await client.query('UPDATE question_options SET text = $1 WHERE id = $2', [option.text, option.id])
    } else {
      const position = Math.max(0, ...existing.map(question => question.position)) + 1
      await client.query('INSERT INTO questions (id, competition_id, prompt, position, correct_option_id) VALUES ($1, $2, $3, $4, $5)',
        [id, competitionId, input.prompt, position, options[input.correctOptionIndex].id])
      for (const [index, option] of options.entries()) {
        await client.query('INSERT INTO question_options (id, question_id, text, position) VALUES ($1, $2, $3, $4)', [option.id, id, option.text, index + 1])
      }
    }
    return (await listQuestions(client, competitionId)).find(question => question.id === id)!
  })
}

export async function deleteQuestion(database: Pool, ownerId: string, competitionId: string, questionId: string) {
  return withDraft(database, ownerId, competitionId, async client => {
    const result = await client.query('DELETE FROM questions WHERE id = $1 AND competition_id = $2', [questionId, competitionId])
    if (!result.rowCount) throw new CompetitionWriteError(404, 'Question not found.')
  })
}
