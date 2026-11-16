import { randomBytes } from 'node:crypto'
import type { Request } from 'express'
import type { Pool } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { hashSecret } from '../../lib/secrets.js'

export const guestSessionLifetimeMs = 24 * 60 * 60 * 1000
export function guestCookieSettings() {
  const production = process.env.NODE_ENV === 'production'
  return { name: production ? '__Host-quizzent_guest' : 'quizzent_guest', options: { httpOnly: true, secure: production, sameSite: 'lax' as const, path: '/' } }
}
export function findGuest(database: Pool, request: Request) {
  return findGuestByToken(database, request.cookies?.[guestCookieSettings().name])
}

export async function findGuestByToken(database: Pool, token: unknown): Promise<string | null> {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null
  const { rows } = await database.query<{ guest_id: string }>('SELECT guest_id FROM guest_sessions WHERE token_hash = $1 AND expires_at > now()', [hashSecret(token)])
  return rows[0]?.guest_id ?? null
}
export async function createGuestSession(database: Pool) {
  return inTransaction(database, async client => {
    const { rows: [guest] } = await client.query<{ id: string }>('INSERT INTO guests DEFAULT VALUES RETURNING id')
    const token = randomBytes(32).toString('hex')
    await client.query('INSERT INTO guest_sessions (guest_id, token_hash, expires_at) VALUES ($1, $2, $3)', [guest.id, hashSecret(token), new Date(Date.now() + guestSessionLifetimeMs)])
    return { guestId: guest.id, token }
  })
}
