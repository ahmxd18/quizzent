import { useParams } from 'react-router'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { RequestError } from '../../../components/ui/RequestError'
import { isLobbyOpen, participantLabel } from '../api/rooms'
import { GuestReadiness } from '../components/GuestReadiness'
import { RoomFeedback } from '../components/RoomFeedback'
import { useGuestRoom } from '../hooks/useGuestRoom'

export function GuestRoomPage() {
  const { id = '' } = useParams()
  const query = useGuestRoom(id)
  const data = query.data
  const open = data && isLobbyOpen(data.room)

  return (
    <PageContainer className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        {data ? <Card className="p-7 sm:p-10">
          <Badge tone={open ? 'accent' : 'neutral'}>{open ? 'You’re in the room' : data.room.status === 'closed' ? 'Room closed' : 'Competition started'}</Badge>
          <h1 className="mt-5 break-words font-display text-4xl tracking-tight">{data.room.title}</h1>
          <p className="mt-4 break-words text-lg font-semibold">{data.participant.nickname}</p>
          <p className="mt-2 text-sm text-muted">{participantLabel(data.participant.participantNumber)} · Room {data.room.code}</p>
          {open && <p className="mt-5 text-sm leading-relaxed text-muted">Keep this tab open while you wait for the competition to start.</p>}
          {!open && data.room.startedAt && <p className="mt-5 text-sm leading-relaxed text-muted" role="status">
            {data.participant.admitted ? 'You made the starting roster.' : 'You weren’t online and ready when the competition started.'}
          </p>}
          {!open && !data.room.startedAt && <p className="mt-5 text-sm text-muted">Your participant record has been preserved.</p>}
          <p className="mt-3 text-sm text-muted">{data.room.participantCount}/50 participants joined</p>
          {open && <GuestReadiness key={id} room={data.room} />}
          <div className="mt-6 space-y-4">
            <RequestError error={query.error} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={query.isFetching} onClick={() => { void query.refetch() }}>{query.isFetching ? 'Refreshing…' : 'Refresh room status'}</Button>
              <ButtonLink to="/" variant="ghost">Home</ButtonLink>
            </div>
          </div>
        </Card> : <RoomFeedback error={query.error} onRetry={() => { void query.refetch() }} />}
      </div>
    </PageContainer>
  )
}
