import { deleteJson, getJson, postJson, putJson } from '../../../lib/http'

export type Question = { id: string; prompt: string; position: number; correctOptionId: string; options: { id: string; text: string }[] }
export type QuestionInput = { prompt: string; options: string[]; correctOptionIndex: number }
const path = (competitionId: string) => `/api/competitions/${encodeURIComponent(competitionId)}/questions`

export const listQuestions = (competitionId: string) => getJson<{ questions: Question[] }>(path(competitionId))
export const createQuestion = (competitionId: string, input: QuestionInput) => postJson<{ question: Question }>(path(competitionId), input)
export const updateQuestion = (competitionId: string, id: string, input: QuestionInput) => putJson<{ question: Question }>(`${path(competitionId)}/${encodeURIComponent(id)}`, input)
export const removeQuestion = (competitionId: string, id: string) => deleteJson<{ message: string }>(`${path(competitionId)}/${encodeURIComponent(id)}`)
