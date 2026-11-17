import { useEffect } from 'react'
import { Button } from '../../../components/ui/Button'
import { RequestError } from '../../../components/ui/RequestError'
import { GuestResults } from '../../results/components/GuestResults'
import type { Attempt } from '../api/attempts'
import { useAttempt } from '../hooks/useAttempt'
import { useQuestionCountdown } from '../hooks/useQuestionCountdown'
import { QuestionForm } from './QuestionForm'

function TimedQuestion({ attempt, roomId, busy, paused, refresh }: {
  attempt: Extract<Attempt, { phase: 'question' }>
  roomId: string
  busy: boolean
  paused: boolean
  refresh: () => void
}) {
  const seconds = useQuestionCountdown(attempt)
  const expired = seconds === 0
  const position = attempt.answered + attempt.timedOut + 1

  useEffect(() => {
    if (!expired || busy || paused) return
    // Ask for the saved result at zero. If the clock was slightly early, check again.
    const timer = window.setTimeout(refresh, 250)
    return () => window.clearTimeout(timer)
  }, [expired, busy, paused, refresh, attempt.receivedAt])

  return (
    <section aria-label="Current question" className="mt-6 space-y-4 border-t border-outline pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand">Question {position} of {attempt.total}</p>
        <span role="timer" aria-label="Time remaining" className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${seconds <= 3 ? 'bg-accent text-foreground' : 'bg-surface-strong text-brand'}`}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      {expired && <p role="status" className="text-sm text-muted">{paused ? 'Time’s up. Waiting for a connection to resume.' : 'Time’s up. Checking your progress…'}</p>}
      <QuestionForm roomId={roomId} question={attempt.question} position={position} expired={expired} />
    </section>
  )
}

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
  if (attempt.phase === 'complete') return (<>
    <section className="mt-6 space-y-2 rounded-xl border border-outline bg-surface-strong p-5" aria-live="polite">
      <h2 className="font-display text-2xl">Quiz complete</h2>
      <p className="text-sm text-muted">{attempt.answered} of {attempt.total} answers saved{attempt.timedOut > 0 ? ` · ${attempt.timedOut} timed out` : ''}.</p>
    </section>
    <GuestResults roomId={roomId} />
  </>)

  return (
    <TimedQuestion
      key={attempt.question.id}
      attempt={attempt}
      roomId={roomId}
      busy={query.isFetching}
      paused={query.isPaused}
      refresh={() => { void query.refetch() }}
    />
  )
}
