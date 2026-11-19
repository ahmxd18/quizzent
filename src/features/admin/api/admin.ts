import { ApiError, getJson, postJson, putJson } from '../../../lib/http'

export type Account = {
  id: string; displayName: string; email: string
  role: 'organiser' | 'superadmin'; status: 'active' | 'suspended'
  hostingRestricted: boolean; weeklyHostingLimit: number | null
}
export type ActiveRoom = { id: string; code: string; title: string; organiserEmail: string; startedAt: string | null }
export type AuditEntry = {
  id: string; actorLabel: string; action: 'bootstrap' | 'role_changed' | 'status_changed' | 'room_cancelled' | 'hosting_changed'
  targetLabel: string; detail: string; createdAt: string
}
export type AdminAction = { label: string; id: string } & (
  | { kind: 'status'; value: Account['status'] }
  | { kind: 'role'; value: Account['role'] }
  | { kind: 'cancelRoom' }
  | { kind: 'hosting'; restricted: boolean; weeklyLimit: number | null }
)
type Overview = { accounts: Account[]; rooms: ActiveRoom[]; actions: AuditEntry[] }

export const getAdminOverview = (search: string) =>
  getJson<Overview>(`/api/admin/overview?${new URLSearchParams({ q: search })}`)

export function submitAdminAction(action: AdminAction, input: { reason: string; password: string; restricted: boolean; weeklyLimit: number | null }) {
  const id = encodeURIComponent(action.id)
  if (action.kind === 'cancelRoom') return postJson<{ message: string }>(`/api/admin/rooms/${id}/cancel`, { reason: input.reason })
  const path = `/api/admin/users/${id}/${action.kind}`
  if (action.kind === 'hosting') return putJson<{ message: string }>(path, { restricted: input.restricted, weeklyLimit: input.weeklyLimit })
  if (action.kind === 'role' || (action.kind === 'status' && action.value === 'suspended')) {
    return putJson<{ message: string }>(path, { [action.kind]: action.value, password: input.password }).catch((error: unknown) => {
      // Transport errors can retain the original request configuration, including its body.
      if (error instanceof ApiError) throw error
      throw new Error('Could not verify the password. Try again.')
    })
  }
  return putJson<{ message: string }>(path, { status: action.value })
}

export const directoryStatuses = { live: 'Live / waiting', ended: 'Ended rooms', drafted: 'Drafted', published: 'Published', cancelled: 'Cancelled' }
export type DirectoryStatus = keyof typeof directoryStatuses
export type DirectoryFilters = { status: string; organisers: string[]; search: string; startDate: string; endDate: string; page: number; pageSize: number }
type DirectoryRecord = {
  id: string; kind: 'competition' | 'room'; title: string; code: string | null
  status: DirectoryStatus; createdAt: string; organiserName: string; organiserEmail: string
}
export function getDirectory(filters: DirectoryFilters) {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) })
  if (filters.organisers.length) params.set('organisers', filters.organisers.join(','))
  for (const name of ['status', 'search', 'startDate', 'endDate'] as const) {
    if (filters[name]) params.set(name, filters[name])
  }
  return getJson<{ records: DirectoryRecord[]; pagination: { totalElements: number; currentPage: number; pageSize: number; totalPages: number } }>(`/api/admin/directory?${params}`)
}

export const getOrganiserOptions = (search: string, page: number) =>
  getJson<{ options: { value: string; label: string }[]; hasNextPage: boolean }>(
    `/api/admin/organisers?${new URLSearchParams({ search, page: String(page) })}`,
  )
