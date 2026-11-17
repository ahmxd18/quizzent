import { getJson } from '../../../lib/http'

export type Standing = {
  rank: number; participantNumber: number; nickname: string
  correct: number; total: number; totalTimeMs: number | null
}
type FinalResults = { phase: 'final'; publishedAt: string; standings: Standing[] }
type Review = {
  position: number; prompt: string; selectedOption: string | null; correctOption: string
  outcome: 'correct' | 'incorrect' | 'timeout'
}
export type GuestResultsData = { phase: 'waiting' | 'closed' }
  | (FinalResults & { participantNumber: number; review: Review[] })
export type OrganiserProgressData = FinalResults | {
  phase: 'running' | 'lobby' | 'closed'
  participants?: { participantId: string; total: number; resolved: number; timedOut: number }[]
}

export const getGuestResults = (roomId: string) =>
  getJson<GuestResultsData>(`/api/guest/rooms/${encodeURIComponent(roomId)}/results`)
export const getOrganiserProgress = (roomId: string) =>
  getJson<OrganiserProgressData>(`/api/rooms/${encodeURIComponent(roomId)}/progress`)
