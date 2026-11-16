import { Button } from '../../../components/ui/Button'
import { RequestError } from '../../../components/ui/RequestError'
import { useAttempt } from '../hooks/useAttempt'
import { QuestionForm } from './QuestionForm'

export function QuizAttempt({ roomId }: { roomId: string }) {
  const query = useAttempt(roomId)
  const attempt = query.data

  if (query.isError) return (
    <section aria-label="Quiz progress" className="mt-6 space-y-4 border-t border-outline pt-6">
      <RequestError error={query.error} />
      <Button variant="secondary" disabled={query.isFetching} onClick={() => { void query.refetch() }}>
        {query.isFetching ? 'Checking progress…' : 'Retry loading progress'}
      </Button>
    </section>
  )
  if (!attempt) return <p role="status" className="mt-6 text-sm text-muted">Loading your question…</p>
  if (attempt.phase === 'complete') return (
    <section className="mt-6 space-y-2 rounded-xl border border-outline bg-surface-strong p-5" aria-live="polite">
      <h2 className="font-display text-2xl">All answers submitted</h2>
      <p className="text-sm text-muted">{attempt.answered} of {attempt.total} answers saved.</p>
    </section>
  )

  return (
    <section aria-label="Current question" className="mt-6 space-y-4 border-t border-outline pt-6">
      <p className="text-sm font-semibold text-brand">Question {attempt.answered + 1} of {attempt.total}</p>
      <QuestionForm key={attempt.question.id} roomId={roomId} question={attempt.question} position={attempt.answered + 1} />
    </section>
  )
}
