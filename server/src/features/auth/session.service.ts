import { createHash, randomBytes } from 'node:crypto'
import type { Pool } from 'pg'

export const sessionLifetimeMs = 24 * 60 * 60 * 1000
export type SessionUser = { id: string; displayName: string; email: string; role: 'organiser' | 'superadmin' }

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(database: Pool, userId: string, previousToken?: string) {
  const token = randomBytes(32).toString('hex')
  // Replacing this browser's previous session and creating its new one happen together.
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    if (previousToken) await client.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(previousToken)])
    await client.query('DELETE FROM user_sessions WHERE user_id = $1 AND expires_at <= now()', [userId])
    await client.query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, hashToken(token), new Date(Date.now() + sessionLifetimeMs)])
    await client.query('COMMIT')
    return token
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function findSessionUser(database: Pool, token: string): Promise<SessionUser | null> {
  const { rows } = await database.query<SessionUser>(
    `SELECT u.id, u.display_name AS "displayName", u.email, u.role
     FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`, [hashToken(token)])
  return rows[0] ?? null
}

export async function deleteSession(database: Pool, token: string) {
  await database.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)])
}
