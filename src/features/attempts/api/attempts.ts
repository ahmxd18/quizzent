import { getJson, postJson } from '../../../lib/http'

export type AttemptQuestion = { id: string; prompt: string; options: { id: string; text: string }[] }
type Progress = { answered: number; total: number }
export type Attempt = Progress & ({ phase: 'question'; question: AttemptQuestion } | { phase: 'complete' })
export type AnswerSubmission = { questionId: string; optionId: string; requestId: string }

const attemptPath = (roomId: string) => `/api/guest/rooms/${encodeURIComponent(roomId)}/attempt`

export const getAttempt = (roomId: string) => getJson<Attempt>(attemptPath(roomId))
export const postAnswer = (roomId: string, answer: AnswerSubmission) => postJson<Attempt>(`${attemptPath(roomId)}/answers`, answer)
