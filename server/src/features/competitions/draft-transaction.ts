import type { Pool, PoolClient } from 'pg'

export class CompetitionWriteError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export async function withDraft<T>(database: Pool, ownerId: string, competitionId: string, write: (client: PoolClient) => Promise<T>) {
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    // All content writes and publishing lock the same parent row, so they cannot race.
    const { rows: [competition] } = await client.query('SELECT status FROM competitions WHERE id = $1 AND organiser_id = $2 FOR UPDATE', [competitionId, ownerId])
    if (!competition) throw new CompetitionWriteError(404, 'Competition not found.')
    if (competition.status !== 'draft') throw new CompetitionWriteError(409, 'This competition is published and can no longer be changed.')
    const result = await write(client)
    await client.query('UPDATE competitions SET updated_at = clock_timestamp() WHERE id = $1', [competitionId])
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}
