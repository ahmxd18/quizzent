import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { participantLabel } from '../../rooms/api/rooms'
import type { Standing } from '../api/results'

export function Leaderboard({ standings, ownNumber }: { standings: Standing[]; ownNumber?: number }) {
  return (
    <section aria-label="Final leaderboard" className="space-y-3">
      <h2 className="font-display text-2xl">Final leaderboard</h2>
      <p className="text-sm text-muted">Ranked by correct answers, then by total time. Exact ties share a rank.</p>
      <Card className="overflow-hidden">
        <ol className="divide-y divide-outline">
          {standings.map(row => (
            <li key={row.participantNumber} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:p-4">
              <Badge tone={row.rank === 1 ? 'accent' : 'neutral'} aria-label={`Rank ${row.rank}`}>#{row.rank}</Badge>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">{row.nickname}</p>
                <p className="text-xs text-muted">{participantLabel(row.participantNumber)}{row.participantNumber === ownNumber ? ' · You' : ''}</p>
              </div>
              <div className="text-right text-sm tabular-nums">
                <p className="font-semibold">{row.correct}/{row.total} correct</p>
                <p className="text-xs text-muted">{row.totalTimeMs === null ? 'Time unavailable' : `${(row.totalTimeMs / 1000).toFixed(3)} s`}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  )
}
