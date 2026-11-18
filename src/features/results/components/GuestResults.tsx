import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { RequestError } from '../../../components/ui/RequestError'
import { useGuestResults } from '../hooks/useResults'
import { Leaderboard } from './Leaderboard'

const outcomeLabels = { correct: 'Correct', incorrect: 'Incorrect', timeout: 'Timed out' }

export function GuestResults({ roomId, roomPublished = false }: { roomId: string; roomPublished?: boolean }) {
  const query = useGuestResults(roomId, roomPublished)
  const result = query.data
  if (query.isError) return (
    <div className="mt-6 space-y-3">
      <RequestError error={query.error} />
      <Button variant="secondary" onClick={() => { void query.refetch() }}>Retry results</Button>
    </div>
  )
  if (result?.phase !== 'final') {
    const message = result?.phase === 'cancelled' ? 'Competition cancelled.' : result?.phase === 'closed'
      ? 'The organiser closed the room before results were published.'
      : result?.phase === 'waiting' ? 'Waiting for the other guests to finish.' : 'Checking for results…'
    return <p role="status" className="mt-5 text-sm text-muted">{message}</p>
  }

  return (
    <div className="mt-6 space-y-6">
      <Leaderboard standings={result.standings} ownNumber={result.participantNumber} />
      <details className="rounded-xl border border-outline bg-surface-strong p-4">
        <summary className="cursor-pointer text-sm font-semibold">Review your answers</summary>
        <ol className="mt-4 space-y-4">
          {result.review.map(item => (
            <li key={item.position} className="space-y-1 border-t border-outline pt-4 text-sm">
              <Badge tone={item.outcome === 'correct' ? 'accent' : 'neutral'}>{outcomeLabels[item.outcome]}</Badge>
              <p className="break-words font-semibold">{item.position}. {item.prompt}</p>
              {item.selectedOption !== null && <p className="break-words text-muted">Your answer: {item.selectedOption}</p>}
              <p className="break-words text-muted">Correct answer: {item.correctOption}</p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}
