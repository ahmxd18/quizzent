import type { Pool } from 'pg'
import { listQuestions } from '../questions/question.service.js'
import { questionSchema } from '../questions/question.schema.js'
import { CompetitionWriteError, withDraft } from './draft-transaction.js'
import { getCompetition } from './competition.service.js'

export async function publishCompetition(database: Pool, ownerId: string, competitionId: string) {
  await withDraft(database, ownerId, competitionId, async client => {
    const questions = await listQuestions(client, competitionId)
    const { rows: [counts] } = await client.query('SELECT count(*)::integer AS total FROM questions WHERE competition_id = $1', [competitionId])
    if (questions.length < 1 || questions.length > 100 || questions.length !== counts.total) {
      throw new CompetitionWriteError(409, 'Add between 1 and 100 complete questions before publishing.')
    }
    for (const question of questions) {
      const input = { prompt: question.prompt, options: question.options.map(option => option.text),
        correctOptionIndex: question.options.findIndex(option => option.id === question.correctOptionId) }
      if (!questionSchema.safeParse(input).success) throw new CompetitionWriteError(409, 'Every question needs four distinct options and one correct answer.')
    }
    // The parent lock is held until commit; concurrent question writes must wait and recheck status.
    await client.query("UPDATE competitions SET status = 'published', published_at = clock_timestamp() WHERE id = $1", [competitionId])
  })
  return getCompetition(database, ownerId, competitionId)
}
