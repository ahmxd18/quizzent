import { parseCookie } from 'cookie'
import type { Pool } from 'pg'
import { z } from 'zod'
import { sessionCookieSettings } from '../auth/session.http.js'
import { findSessionUser } from '../auth/session.service.js'
import { findGuestByToken, guestCookieSettings } from '../rooms/guest-session.service.js'

const subscription = z.strictObject({ roomId: z.uuid(), role: z.enum(['organiser', 'guest']) })

export async function getLobbyAccess(database: Pool, auth: unknown, cookieHeader: string | undefined) {
  const result = subscription.safeParse(auth)
  if (!result.success) return null
  const { roomId, role } = result.data
  const cookies = parseCookie(cookieHeader ?? '')

  if (role === 'organiser') {
    const token = cookies[sessionCookieSettings().name]
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null
    const user = await findSessionUser(database, token)
    if (!user) return null
    const owned = await database.query(
      "SELECT id FROM rooms WHERE id = $1 AND organiser_id = $2 AND status = 'open'",
      [roomId, user.id],
    )
    return owned.rowCount ? { role, roomId } as const : null
  }

  const guestId = await findGuestByToken(database, cookies[guestCookieSettings().name])
  if (!guestId) return null
  const { rows: [participant] } = await database.query<{ id: string }>(
    `SELECT p.id FROM room_participants p JOIN rooms r ON r.id = p.room_id
     WHERE p.room_id = $1 AND p.guest_id = $2 AND r.status = 'open'`,
    [roomId, guestId],
  )
  return participant ? { role, roomId, participantId: participant.id } as const : null
}

export type LobbyAccess = NonNullable<Awaited<ReturnType<typeof getLobbyAccess>>>
