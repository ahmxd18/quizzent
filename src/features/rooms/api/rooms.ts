import { getJson, postJson } from '../../../lib/http'

export type AdmissionMode = 'open' | 'invitation'
export type Room = { id: string; code: string; competitionId: string; title: string; admissionMode: AdmissionMode; status: 'open' | 'closed'; participantCount: number; createdAt: string; closedAt: string | null }
export type Participant = { id: string; nickname: string; participantNumber: number; organiserReference: string | null; joinedAt: string }
export type Invitation = { id: string; reference: string; participantId: string | null; createdAt: string }
export type RoomDetails = { room: Room; participants: Participant[]; invitations: Invitation[] }
export type InvitationLink = { invitation: { id: string; reference: string }; token: string }
const roomPath = (id: string) => `/api/rooms/${encodeURIComponent(id)}`

export const listRooms = () => getJson<{ rooms: Room[] }>('/api/rooms')
export const getRoom = (id: string) => getJson<RoomDetails>(roomPath(id))
export const createRoom = (input: { competitionId: string; admissionMode: AdmissionMode }) => postJson<{ room: Room }>('/api/rooms', input)
export const closeRoom = (id: string) => postJson<{ message: string }>(`${roomPath(id)}/close`, {})
export const createInvitation = (roomId: string, reference: string) => postJson<InvitationLink>(`${roomPath(roomId)}/invitations`, { reference })
export const renewInvitation = (roomId: string, invitationId: string) => postJson<InvitationLink>(`${roomPath(roomId)}/invitations/${encodeURIComponent(invitationId)}/link`, {})
export const roomJoinLink = (room: Room) => `${window.location.origin}/join/${room.code}`
export const personalJoinLink = (room: Room, token: string) => `${roomJoinLink(room)}#invite=${token}`
export const participantLabel = (number: number) => `P${String(number).padStart(3, '0')}`
