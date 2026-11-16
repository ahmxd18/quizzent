import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { participantLabel, type Participant } from '../api/rooms'

type RosterProps = {
  participants: Participant[]
  emptyMessage: string
  onlineParticipants?: { participantId: string; ready: boolean }[]
}

export function ParticipantRoster({ participants, emptyMessage, onlineParticipants }: RosterProps) {
  const readiness = new Map(onlineParticipants?.map(entry => [entry.participantId, entry.ready]))
  const columns = onlineParticipants ? 'md:grid-cols-[90px_1fr_1fr_130px]' : 'md:grid-cols-[90px_1fr_1fr]'
  return <section aria-labelledby="participants-title"><h2 id="participants-title" className="text-2xl font-semibold">Participants <span className="text-muted">({participants.length}/50)</span></h2>
    <p className="mb-5 mt-2 text-sm leading-relaxed text-muted">Participant numbers identify records in this room. Personal references come from your invitations, never from a guest’s nickname.</p>
    <Card className="overflow-hidden">
      {participants.length === 0 ? <p className="p-8 text-sm text-muted">{emptyMessage}</p> : <>
        <div className={`hidden gap-5 border-b border-outline bg-surface-strong px-6 py-4 text-xs font-semibold text-muted md:grid ${columns}`}><span>Participant</span><span>Your reference</span><span>Guest nickname</span>{onlineParticipants && <span>Lobby status</span>}</div>
        <ul className="divide-y divide-outline">{participants.map(participant => <li key={participant.id} className={`grid min-w-0 gap-4 p-6 md:gap-5 ${columns}`}>
          <div><span className="mb-1 block text-xs text-muted md:sr-only">Participant</span><span title={participant.id} className="font-semibold text-brand">{participantLabel(participant.participantNumber)}</span></div>
          <div className="min-w-0"><span className="mb-1 block text-xs text-muted md:sr-only">Your reference</span><p className="break-words text-sm font-semibold">{participant.organiserReference ?? 'No assigned reference'}</p><Badge tone={participant.organiserReference ? 'brand' : 'neutral'} className="mt-2">{participant.organiserReference ? 'Personal invitation' : 'Unverified code join'}</Badge></div>
          <div className="min-w-0"><span className="mb-1 block text-xs text-muted md:sr-only">Guest nickname</span><p className="break-words text-sm">{participant.nickname}</p></div>
          {onlineParticipants && <div>
            <span className="mb-1 block text-xs text-muted md:sr-only">Lobby status</span>
            <Badge tone={readiness.get(participant.id) ? 'accent' : 'neutral'}>
              {readiness.get(participant.id) ? 'Ready' : readiness.has(participant.id) ? 'Not ready' : 'Offline'}
            </Badge>
          </div>}
        </li>)}</ul>
      </>}
    </Card>
  </section>
}
