import { createHash, randomBytes } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { inTransaction } from '../../lib/transaction.js'

export const sessionLifetimeMs = 24 * 60 * 60 * 1000
export type SessionUser = { id: string; displayName: string; email: string; role: 'organiser' | 'superadmin' }

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(database: Pool, userId: string, previousToken?: string, verifiedRole?: SessionUser['role']) {
  const token = randomBytes(32).toString('hex')
  return inTransaction(database, async client => {
    // Lock the account so a concurrent suspension cannot miss revoking this session.
    const { rows: [account] } = await client.query<{ role: SessionUser['role']; status: string }>(
      'SELECT role, status FROM users WHERE id = $1 FOR UPDATE', [userId],
    )
    if (account?.status !== 'active' || (verifiedRole !== undefined && verifiedRole !== account.role)) return null
    if (previousToken) await client.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(previousToken)])
    await client.query('DELETE FROM user_sessions WHERE user_id = $1 AND expires_at <= now()', [userId])
    await client.query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, hashToken(token), new Date(Date.now() + sessionLifetimeMs)])
    return token
  })
}

export async function findSessionUser(database: Pool | PoolClient, token: string): Promise<SessionUser | null> {
  const { rows } = await database.query<SessionUser>(
    `SELECT u.id, u.display_name AS "displayName", u.email, u.role
     FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`, [hashToken(token)])
  return rows[0] ?? null
}

export async function deleteSession(database: Pool, token: string) {
  await database.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)])
}
