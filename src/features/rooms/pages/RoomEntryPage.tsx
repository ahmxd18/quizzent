import { Navigate, useLocation, useParams } from 'react-router'
import { PageContainer } from '../../../components/layout/PageContainer'
import { ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { RequestError } from '../../../components/ui/RequestError'
import { isLobbyOpen } from '../api/rooms'
import { GuestJoinForm } from '../components/GuestJoinForm'
import { RoomFeedback } from '../components/RoomFeedback'
import { useGuestSession, useRoomPreview } from '../hooks/useGuestRoom'

export function RoomEntryPage() {
  const { code = '' } = useParams()
  const { hash } = useLocation()
  // URL fragments are not sent in HTTP URLs or Referer headers. Send the secret only in the join body.
  const invitationToken = new URLSearchParams(hash.slice(1)).get('invite') ?? undefined
  const invalidLink = invitationToken !== undefined && !/^[0-9a-f]{64}$/.test(invitationToken)
  const query = useRoomPreview(code)
  const preview = query.data
  const admissionClosed = !!preview && !isLobbyOpen(preview.room)
  const needsInvitation = preview?.room.admissionMode === 'invitation' && invitationToken === undefined
  const needsSession = !!preview && !admissionClosed && !preview.participantId && !needsInvitation && !invalidLink
  const session = useGuestSession(needsSession)
  let content
  if (!preview) content = <RoomFeedback error={query.error} onRetry={() => { void query.refetch() }} />
  else if (preview.participantId && (invitationToken === undefined || admissionClosed)) return <Navigate to={`/rooms/${preview.room.id}`} replace />
  else if (admissionClosed || invalidLink || needsInvitation) {
    let title = 'A personal invitation is needed.'
    if (admissionClosed) title = preview.room.status === 'closed' ? 'This room is closed.' : 'This competition has already started.'
    else if (invalidLink) title = 'This invitation link is invalid.'
    content = <Card className="p-8">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">{needsInvitation && !admissionClosed && !invalidLink ? 'Ask your organiser for your own invitation link.' : 'Contact your organiser for help.'}</p>
      <ButtonLink to="/join" variant="secondary" className="mt-6">Enter another room code</ButtonLink>
    </Card>
  }
  else if (needsSession && (session.isPending || session.isError)) content = <RoomFeedback error={session.error} onRetry={() => { void session.refetch() }} />
  else content = <><RequestError error={query.error} /><GuestJoinForm key={`${preview.room.id}:${invitationToken ?? ''}`} preview={preview} invitationToken={invitationToken} suggestName={async () => (await query.refetch()).data?.suggestedNickname} /></>
  return <PageContainer className="py-12 sm:py-16"><div className="mx-auto max-w-xl">{content}</div></PageContainer>
}
