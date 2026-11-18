import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { RequestError } from '../../../components/ui/RequestError'
import { participantLabel, type Participant } from '../../rooms/api/rooms'
import { useOrganiserProgress } from '../hooks/useResults'
import { Leaderboard } from './Leaderboard'

export function OrganiserProgress({ roomId, roomPublished, roster }: { roomId: string; roomPublished: boolean; roster: Participant[] }) {
  const query = useOrganiserProgress(roomId, roomPublished)
  const details = query.data
  if (query.isError) return <div className="space-y-3">
    <RequestError error={query.error} />
    <Button variant="secondary" onClick={() => { void query.refetch() }}>Retry competition progress</Button>
  </div>
  if (!details) return <p role="status" className="text-sm text-muted">Loading competition progress…</p>
  if (details.phase === 'final') return <Leaderboard standings={details.standings} />

  const progress = details.participants ?? []
  const finished = progress.filter(person => person.resolved === person.total).length
  const byId = new Map(roster.map(person => [person.id, person]))
  return (
    <section aria-label="Competition progress" className="space-y-3">
      <h2 className="font-display text-2xl">Competition progress</h2>
      <p className="text-sm text-muted" role="status">
        {finished} of {progress.length} guests finished.{details.phase === 'closed' ? ' The room was closed before results were published.' : ''}
      </p>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-outline">
          {progress.map(person => {
            const entry = byId.get(person.participantId)
            return (
              <li key={person.participantId} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{entry?.nickname ?? 'Guest'}</p>
                  {entry && <p className="text-xs text-muted">{participantLabel(entry.participantNumber)}</p>}
                </div>
                <span className="text-muted">
                  {person.resolved === person.total ? 'Finished' : `${person.resolved}/${person.total} resolved`}
                  {person.timedOut > 0 && ` · ${person.timedOut} timed out`}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
  )
}
