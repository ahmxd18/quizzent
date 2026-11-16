import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { RequestError } from '../../../components/ui/RequestError'
import { useRooms } from '../hooks/useRooms'

export function RoomList() {
  const query = useRooms()
  if (query.isPending) return <p role="status" className="mt-8 text-sm text-muted">Loading your rooms…</p>
  if (query.isError) return <div className="mt-8"><RequestError error={query.error} /><Button size="sm" variant="secondary" className="mt-3" onClick={() => { void query.refetch() }}>Retry rooms</Button></div>
  if (!query.data.rooms.length) return null
  return <section aria-labelledby="recent-rooms-title" className="mt-10"><h2 id="recent-rooms-title" className="text-xl font-semibold">Your rooms</h2><ul className="mt-5 space-y-3">{query.data.rooms.map(room => <li key={room.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline bg-surface p-5">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h3 className="min-w-0 max-w-full break-words font-semibold">{room.title}</h3><Badge tone={room.status === 'open' ? 'accent' : 'neutral'}>{room.status === 'closed' ? 'Closed' : room.startedAt ? 'Started' : 'Open'}</Badge></div><p className="mt-2 text-xs text-muted">{room.code} · {room.participantCount}/50 joined</p></div><ButtonLink to={`/organiser/rooms/${room.id}`} size="sm" variant="secondary">{room.status === 'open' ? 'Manage room' : 'View room record'}</ButtonLink>
  </li>)}</ul></section>
}
