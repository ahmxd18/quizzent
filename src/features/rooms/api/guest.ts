import { getJson, postJson } from '../../../lib/http'
import type { Room } from './rooms'

export type RoomPreview = { room: Room; suggestedNickname: string; participantId: string | null }
export type GuestRoom = { room: Room; participant: { id: string; nickname: string; participantNumber: number; admitted: boolean } }
export const startGuestSession = () => postJson<{ ready: true }>('/api/guest/session', {})
export const previewRoom = (code: string) => getJson<RoomPreview>(`/api/room-entry/${encodeURIComponent(code)}`)
export const joinRoom = (code: string, input: { nickname: string; invitationToken?: string }) => postJson<{ roomId: string; participantId: string }>(`/api/room-entry/${encodeURIComponent(code)}/join`, input)
export const getGuestRoom = (id: string) => getJson<GuestRoom>(`/api/guest/rooms/${encodeURIComponent(id)}`)
