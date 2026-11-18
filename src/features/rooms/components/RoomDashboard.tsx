import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { CopyButton } from '../../../components/ui/CopyButton'
import { RequestError } from '../../../components/ui/RequestError'
import { OrganiserProgress } from '../../results/components/OrganiserProgress'
import { isLobbyOpen, roomJoinLink, type RoomDetails } from '../api/rooms'
import { useRoomActions } from '../hooks/useRooms'
import { useLiveLobby } from '../hooks/useLiveLobby'
import { InvitationManager } from './InvitationManager'
import { LobbyConnection } from './LobbyConnection'
import { LobbyCountdown } from './LobbyCountdown'
import { ParticipantRoster } from './ParticipantRoster'
import { CancellationNotice } from './RoomNotices'
import { CancelCompetition } from './CancelCompetition'

export function RoomDashboard({ details, disconnected, refreshing, onRefresh }: { details: RoomDetails; disconnected: boolean; refreshing: boolean; onRefresh: () => void }) {
  const { room, participants, invitations } = details
  const open = room.status === 'open'
  const published = !!room.resultsPublishedAt
  const cancelled = !!room.cancellationReason
  const inLobby = isLobbyOpen(room)
  const lobby = useLiveLobby(room.id, 'organiser', inLobby)
  const liveRoster = lobby.state && 'participants' in lobby.state ? lobby.state.participants : undefined
  const admittedCount = participants.filter(participant => participant.admitted).length
  const { close } = useRoomActions(room.id)
  const [closing, setClosing] = useState(false)
  return <div className="space-y-9">
    <div><Badge tone={open || published ? 'accent' : 'neutral'}>{cancelled ? 'Cancelled' : published ? 'Results published' : inLobby ? 'Room open' : open ? 'Competition started' : 'Room closed'}</Badge><h1 className="mt-4 break-words font-display text-4xl tracking-tight sm:text-5xl">{room.title}</h1><p className="mt-3 text-sm text-muted">{inLobby ? (room.admissionMode === 'open' ? 'Open code admission · Personal invitations optional' : 'Personal invitations required') : 'Admission is closed.'}</p></div>
    <CancellationNotice room={room} />
    <RequestError error={close.error} />
    {inLobby && <Card className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Room code</p><p className="mt-2 text-3xl font-semibold tracking-widest text-brand">{room.code}</p><p className="mt-2 text-sm text-muted">{room.admissionMode === 'open' ? 'The code admits guests without verifying who they are.' : 'The code can find this room; a personal link is needed to join.'}</p></div>
      {room.admissionMode === 'open' && <CopyButton value={roomJoinLink(room)} label="Copy room link" />}
    </Card>}
    {inLobby && <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <LobbyConnection connection={lobby.connection} onRetry={lobby.reconnect} />
        {lobby.state && <p className="font-semibold" aria-live="polite"><span className="text-brand">{lobby.state.readyCount} ready</span> · {lobby.state.onlineCount} online</p>}
      </div>
      {lobby.state && <LobbyCountdown room={room} readyCount={lobby.state.readyCount} clockOffset={lobby.clockOffset} />}
    </Card>}
    {room.startedAt && <p role="status" className="text-sm font-semibold text-brand">
      {admittedCount} {admittedCount === 1 ? 'guest' : 'guests'} made the starting roster.
    </p>}
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" size="sm" disabled={refreshing || disconnected} onClick={onRefresh}>{refreshing ? 'Refreshing…' : 'Refresh participants'}</Button>
      {inLobby && <Button variant="ghost" size="sm" disabled={disconnected} onClick={() => setClosing(true)}>Close room</Button>}
      {open && !inLobby && <CancelCompetition roomId={room.id} disconnected={disconnected} />}
    </div>
    {room.startedAt && !cancelled && <OrganiserProgress roomId={room.id} roomPublished={published} roster={participants} />}
    <ParticipantRoster participants={participants} onlineParticipants={liveRoster} showAdmission={!!room.startedAt} emptyMessage={room.status === 'closed' ? 'No guests joined before this room closed.' : room.admissionMode === 'invitation' ? 'Create personal invitations below. Guests will appear here after joining with their own links.' : 'Share the room link or create personal invitations below. Guests will appear here after joining.'} />
    <InvitationManager room={room} invitations={invitations} />
    <ConfirmDialog open={inLobby && closing} title="Close this room?" description="Closing stops new joins and keeps the existing participant records." confirmLabel="Close room" cancelLabel="Keep room open" pending={close.isPending} confirmDisabled={disconnected} onCancel={() => setClosing(false)} onConfirm={() => { if (!close.isPending && !disconnected) close.mutate(undefined, { onSuccess: () => setClosing(false), onError: () => setClosing(false) }) }} />
  </div>
}
