import { useParams } from 'react-router'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { RequestError } from '../../../components/ui/RequestError'
import { participantLabel } from '../api/rooms'
import { RoomFeedback } from '../components/RoomFeedback'
import { useGuestRoom } from '../hooks/useGuestRoom'

export function GuestRoomPage() {
  const { id = '' } = useParams()
  const query = useGuestRoom(id)
  const data = query.data
  return <PageContainer className="py-12 sm:py-16"><div className="mx-auto max-w-xl">
    {data ? <Card className="p-7 sm:p-10"><Badge tone={data.room.status === 'open' ? 'accent' : 'neutral'}>{data.room.status === 'open' ? 'You’re in the room' : 'Room closed'}</Badge><h1 className="mt-5 break-words font-display text-4xl tracking-tight">{data.room.title}</h1><p className="mt-4 break-words text-lg font-semibold">{data.participant.nickname}</p><p className="mt-2 text-sm text-muted">{participantLabel(data.participant.participantNumber)} · Room {data.room.code}</p><p className="mt-5 text-sm leading-relaxed text-muted">{data.room.status === 'open' ? 'Waiting for your organiser. Keep this browser open to retain your participant identity.' : 'This room is no longer admitting guests. Your participant record has been preserved.'}</p><p className="mt-3 text-sm text-muted">{data.room.participantCount}/50 participants joined</p><div className="mt-6 space-y-4"><RequestError error={query.error} /><Button variant="secondary" disabled={query.isFetching} onClick={() => { void query.refetch() }}>{query.isFetching ? 'Refreshing…' : 'Refresh room status'}</Button><ButtonLink to="/" variant="ghost" className="ml-2">Home</ButtonLink></div></Card> : <RoomFeedback error={query.error} onRetry={() => { void query.refetch() }} />}
  </div></PageContainer>
}
