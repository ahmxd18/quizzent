import { getJson, postJson, putJson } from '../../../lib/http'

export type CompetitionInput = { title: string; description: string; questionTimeSeconds: number }
export type Competition = CompetitionInput & { id: string; status: 'draft'; createdAt: string; updatedAt: string }
type CompetitionResponse = { competition: Competition }

export const listCompetitions = () => getJson<{ competitions: Competition[] }>('/api/competitions')
export const getCompetition = (id: string) => getJson<CompetitionResponse>(`/api/competitions/${encodeURIComponent(id)}`)
export const createCompetition = (input: CompetitionInput) => postJson<CompetitionResponse>('/api/competitions', input)
export const updateCompetition = (id: string, input: CompetitionInput) => putJson<CompetitionResponse>(`/api/competitions/${encodeURIComponent(id)}`, input)
