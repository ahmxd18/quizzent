import { getJson, postJson } from '../../../lib/http'

export type AttemptQuestion = { id: string; prompt: string; options: { id: string; text: string }[] }
type Progress = { answered: number; timedOut: number; total: number }
type AttemptResponse = Progress & ({
  phase: 'question'; question: AttemptQuestion; issuedAt: string; deadlineAt: string; serverNow: string
} | { phase: 'complete' })
export type Attempt = AttemptResponse & { receivedAt: number }
export type AnswerSubmission = { questionId: string; optionId: string; requestId: string }

const attemptPath = (roomId: string) => `/api/guest/rooms/${encodeURIComponent(roomId)}/attempt`

async function markReceipt(response: Promise<AttemptResponse>): Promise<Attempt> {
  const data = await response
  // A monotonic clock keeps the display stable if the device's wall clock changes.
  return { ...data, receivedAt: performance.now() }
}

export const getAttempt = (roomId: string) => markReceipt(getJson<AttemptResponse>(attemptPath(roomId)))
export const postAnswer = (roomId: string, answer: AnswerSubmission) => markReceipt(postJson<AttemptResponse>(`${attemptPath(roomId)}/answers`, answer))
