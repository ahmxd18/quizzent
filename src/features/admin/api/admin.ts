import { getJson, postJson, putJson } from '../../../lib/http'

export type Account = {
  id: string; displayName: string; email: string
  role: 'organiser' | 'superadmin'; status: 'active' | 'suspended'
}
export type ActiveRoom = { id: string; code: string; title: string; organiserEmail: string; startedAt: string | null }
export type AuditEntry = {
  id: string; actorLabel: string; action: 'bootstrap' | 'role_changed' | 'status_changed' | 'room_cancelled'
  targetLabel: string; detail: string; createdAt: string
}
export type AdminAction = { label: string; id: string } & (
  | { kind: 'status'; value: Account['status'] }
  | { kind: 'role'; value: Account['role'] }
  | { kind: 'cancelRoom' }
)
type Overview = { accounts: Account[]; rooms: ActiveRoom[]; actions: AuditEntry[] }

export const getAdminOverview = (search: string) =>
  getJson<Overview>(`/api/admin/overview?${new URLSearchParams({ q: search })}`)

export function submitAdminAction(action: AdminAction, reason: string) {
  const id = encodeURIComponent(action.id)
  if (action.kind === 'cancelRoom') return postJson<{ message: string }>(`/api/admin/rooms/${id}/cancel`, { reason })
  return putJson<{ message: string }>(`/api/admin/users/${id}/${action.kind}`, { [action.kind]: action.value })
}
