import type { Pool, PoolClient } from 'pg'
import { inTransaction } from '../../lib/transaction.js'
import { findSessionUser, type SessionUser } from '../auth/session.service.js'
import { verifyPassword } from '../auth/password.js'
import { writeRoomCancellation } from '../rooms/cancellation.service.js'
import { AdminError } from './admin.error.js'

type AccountStatus = 'active' | 'suspended'
type Account = Pick<SessionUser, 'id' | 'email' | 'role'> & { status: AccountStatus }
type AccountChange = { field: 'role'; value: SessionUser['role']; password: string } | { field: 'status'; value: AccountStatus }
type AuditAction = 'bootstrap' | 'role_changed' | 'status_changed' | 'room_cancelled' | 'hosting_changed'
type HostingPolicy = { restricted: boolean; weeklyLimit: number | null }

async function lockAdminChanges(client: PoolClient) {
  // Serialise admin changes, including the one-time bootstrap. Postgres releases the lock at commit.
  await client.query('SELECT pg_advisory_xact_lock(9214, 1531)')
}

async function audit(client: PoolClient, actor: SessionUser | null, action: AuditAction, targetId: string, label: string, detail: string) {
  await client.query(
    'INSERT INTO admin_audit (actor_id, actor_label, action, target_id, target_label, detail) VALUES ($1, $2, $3, $4, $5, $6)',
    [actor?.id ?? null, actor?.email ?? 'Local bootstrap', action, targetId, label, detail],
  )
}

async function adminWrite<T>(database: Pool, token: string | undefined, write: (client: PoolClient, actor: SessionUser) => Promise<T>) {
  return inTransaction(database, async client => {
    await lockAdminChanges(client)
    // A queued request must use the actor's current privileges, even after middleware checked them.
    const actor = token ? await findSessionUser(client, token) : null
    if (!actor) throw new AdminError(401, 'Please log in to continue.')
    if (actor.role !== 'superadmin') throw new AdminError(403, 'Superadmin access is required.')
    return write(client, actor)
  })
}

export async function bootstrapSuperadmin(database: Pool, email: string) {
  return inTransaction(database, async client => {
    await lockAdminChanges(client)
    const existing = await client.query("SELECT 1 FROM users WHERE role = 'superadmin' LIMIT 1")
    if (existing.rowCount) throw new AdminError(409, 'A superadmin already exists. Manage roles from the admin page.')
    const { rows: [account] } = await client.query<Account>(
      'SELECT id, email, role, status FROM users WHERE lower(email) = $1 FOR UPDATE', [email.trim().toLowerCase()],
    )
    if (!account || account.status !== 'active') throw new AdminError(404, 'Sign up for an active organiser account first.')
    await client.query("UPDATE users SET role = 'superadmin' WHERE id = $1", [account.id])
    await client.query('DELETE FROM user_sessions WHERE user_id = $1', [account.id])
    await audit(client, null, 'bootstrap', account.id, account.email, 'organiser → superadmin')
    return account.email
  })
}

export async function changeAccount(database: Pool, token: string | undefined, targetId: string, change: AccountChange) {
  return adminWrite(database, token, async (client, actor) => {
    if (actor.id === targetId) throw new AdminError(409, 'You cannot change your own role or status.')
    if (change.field === 'role') {
      const { rows: [credentials] } = await client.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1', [actor.id],
      )
      if (!credentials || !await verifyPassword(change.password, credentials.password_hash)) {
        throw new AdminError(403, 'The current password is incorrect.')
      }
    }
    const { rows: [target] } = await client.query<Account>(
      'SELECT id, email, role, status FROM users WHERE id = $1 FOR UPDATE', [targetId],
    )
    if (!target) throw new AdminError(404, 'Account not found.')
    const before = target[change.field]
    if (before === change.value) return
    const update = change.field === 'role'
      ? 'UPDATE users SET role = $2 WHERE id = $1'
      : 'UPDATE users SET status = $2 WHERE id = $1'
    await client.query(update, [targetId, change.value])
    await client.query('DELETE FROM user_sessions WHERE user_id = $1', [targetId])
    const action = change.field === 'role' ? 'role_changed' : 'status_changed'
    await audit(client, actor, action, target.id, target.email, `${before} → ${change.value}`)
  })
}

export async function setHostingPolicy(database: Pool, token: string | undefined, targetId: string, policy: HostingPolicy) {
  await adminWrite(database, token, async (client, actor) => {
    const { rows: [target] } = await client.query<HostingPolicy & { email: string }>(
      'SELECT email, hosting_restricted AS restricted, weekly_hosting_limit AS "weeklyLimit" FROM users WHERE id = $1 FOR UPDATE',
      [targetId],
    )
    if (!target) throw new AdminError(404, 'Account not found.')
    if (target.restricted === policy.restricted && target.weeklyLimit === policy.weeklyLimit) return
    await client.query('UPDATE users SET hosting_restricted = $2, weekly_hosting_limit = $3 WHERE id = $1',
      [targetId, policy.restricted, policy.weeklyLimit])
    const describe = (value: HostingPolicy) => `${value.restricted ? 'Restricted' : 'Allowed'}, ${value.weeklyLimit ?? 'unlimited'}/week`
    await audit(client, actor, 'hosting_changed', targetId, target.email, `${describe(target)} → ${describe(policy)}`)
  })
}

export async function cancelAdminRoom(database: Pool, token: string | undefined, roomId: string, reason: string) {
  await adminWrite(database, token, async (client, actor) => {
    const { rows: [room] } = await client.query<{ code: string; title: string }>(
      'SELECT r.code, c.title FROM rooms r JOIN competitions c ON c.id = r.competition_id WHERE r.id = $1', [roomId],
    )
    if (!room) throw new AdminError(404, 'Room not found.')
    await writeRoomCancellation(client, roomId, 'superadmin', reason)
    await audit(client, actor, 'room_cancelled', roomId, `${room.title} (${room.code})`, reason)
  })
}

export async function inspectAdminOverview(database: Pool, search: string) {
  const [accounts, rooms, actions] = await Promise.all([
    database.query(
      `SELECT id, display_name AS "displayName", email, role, status,
         hosting_restricted AS "hostingRestricted", weekly_hosting_limit AS "weeklyHostingLimit"
       FROM users WHERE position($1 in lower(email)) > 0 OR position($1 in lower(display_name)) > 0
       ORDER BY created_at DESC, id LIMIT 50`, [search],
    ),
    database.query(
      `SELECT r.id, r.code, c.title, u.email AS "organiserEmail", r.started_at AS "startedAt"
       FROM rooms r JOIN competitions c ON c.id = r.competition_id JOIN users u ON u.id = r.organiser_id
       WHERE r.status = 'open' AND (
         position($1 in lower(r.code)) > 0 OR position($1 in lower(c.title)) > 0 OR position($1 in lower(u.email)) > 0
       ) ORDER BY r.created_at DESC, r.id LIMIT 50`, [search],
    ),
    database.query(
      `SELECT id, actor_label AS "actorLabel", action, target_label AS "targetLabel", detail, created_at AS "createdAt"
       FROM admin_audit ORDER BY created_at DESC, id DESC LIMIT 20`,
    ),
  ])
  return { accounts: accounts.rows, rooms: rooms.rows, actions: actions.rows }
}
