import type { Pool, PoolClient } from 'pg'
import { RoomError } from './room.error.js'

export function hostingWeek(now: Date) {
  const start = new Date(now.getTime())
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
  const end = new Date(start.getTime())
  end.setUTCDate(end.getUTCDate() + 7)
  return { start, end }
}

export async function readHostingPolicy(database: Pool | PoolClient, ownerId: string, now = new Date()) {
  const { start, end } = hostingWeek(now)
  const { rows: [policy] } = await database.query<{ restricted: boolean; weeklyLimit: number | null; used: number }>(
    `SELECT u.hosting_restricted AS restricted, u.weekly_hosting_limit AS "weeklyLimit",
       (SELECT count(*)::integer FROM rooms r WHERE r.organiser_id = u.id AND r.created_at >= $2 AND r.created_at < $3) AS used
     FROM users u WHERE u.id = $1 AND u.status = 'active'`,
    [ownerId, start, end],
  )
  if (!policy) throw new RoomError(401, 'Please log in to continue.')
  return { ...policy, resetsAt: end }
}
