import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { CopyButton } from '../../../components/ui/CopyButton'
import { RequestError } from '../../../components/ui/RequestError'
import { roomJoinLink, type RoomDetails } from '../api/rooms'
import { useRoomActions } from '../hooks/useRooms'
import { InvitationManager } from './InvitationManager'
import { ParticipantRoster } from './ParticipantRoster'

export function RoomDashboard({ details, refreshing, onRefresh }: { details: RoomDetails; refreshing: boolean; onRefresh: () => void }) {
  const { room, participants, invitations } = details
  const { close } = useRoomActions(room.id)
  const [closing, setClosing] = useState(false)
  return <div className="space-y-9">
    <div><Badge tone={room.status === 'open' ? 'accent' : 'neutral'}>{room.status === 'open' ? 'Room open' : 'Room closed · record preserved'}</Badge><h1 className="mt-4 break-words font-display text-4xl tracking-tight sm:text-5xl">{room.title}</h1><p className="mt-3 text-sm text-muted">{room.admissionMode === 'open' ? 'Open code admission · Personal invitations optional' : 'Personal invitations required'}</p></div>
    <RequestError error={close.error} />
    <Card className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Room code</p><p className="mt-2 text-3xl font-semibold tracking-widest text-brand">{room.code}</p><p className="mt-2 text-sm text-muted">{room.admissionMode === 'open' ? 'The code admits guests without verifying who they are.' : 'The code can find this room; a personal link is needed to join.'}</p></div>
      {room.status === 'open' && room.admissionMode === 'open' && <CopyButton value={roomJoinLink(room)} label="Copy room link" />}
    </Card>
    <div className="flex flex-wrap gap-3"><Button variant="secondary" size="sm" disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Refreshing…' : 'Refresh participants'}</Button>{room.status === 'open' && <Button variant="ghost" size="sm" onClick={() => setClosing(true)}>Close room</Button>}</div>
    <ParticipantRoster participants={participants} emptyMessage={room.status === 'closed' ? 'No guests joined before this room closed.' : room.admissionMode === 'invitation' ? 'Create personal invitations below. Guests will appear here after joining with their own links.' : 'Share the room link or create personal invitations below. Guests will appear here after joining.'} />
    <InvitationManager room={room} invitations={invitations} />
    <ConfirmDialog open={closing} title="Close this room?" description="No new guests will be admitted. Existing participant references and nicknames remain in the room record." confirmLabel="Close room" cancelLabel="Keep room open" pending={close.isPending} onCancel={() => setClosing(false)} onConfirm={() => { if (!close.isPending) close.mutate(undefined, { onSuccess: () => setClosing(false), onError: () => setClosing(false) }) }} />
  </div>
}
