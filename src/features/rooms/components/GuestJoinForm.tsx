import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { RequestError } from '../../../components/ui/RequestError'
import { TextField } from '../../../components/ui/TextField'
import type { RoomPreview } from '../api/guest'
import { useJoinRoom } from '../hooks/useGuestRoom'

export function GuestJoinForm({ preview, invitationToken, suggestName }: { preview: RoomPreview; invitationToken?: string; suggestName: () => Promise<string | undefined> }) {
  const [nickname, setNickname] = useState(preview.suggestedNickname)
  const [suggesting, setSuggesting] = useState(false)
  const mutation = useJoinRoom(preview.room.code)
  const navigate = useNavigate()
  const existing = !!preview.participantId
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    mutation.mutate({ nickname: existing ? preview.suggestedNickname : nickname, ...(invitationToken !== undefined ? { invitationToken } : {}) }, { onSuccess: result => navigate(`/rooms/${result.roomId}`, { replace: true }) })
  }
  async function suggest() {
    setSuggesting(true)
    try { const name = await suggestName(); if (name) setNickname(name) }
    finally { setSuggesting(false) }
  }
  return <Card className="p-7 sm:p-10">
    <Badge tone="accent">{invitationToken ? 'Personal invitation' : 'Room code admission'}</Badge>
    <h1 className="mt-5 break-words font-display text-3xl tracking-tight sm:text-4xl">{preview.room.title}</h1>
    <p className="mt-3 text-sm text-muted">{preview.room.participantCount}/50 joined · Room {preview.room.code}</p>
    <p className="mt-4 text-sm leading-relaxed text-muted">{invitationToken ? 'Your organiser’s reference is separate from your nickname. Only the organiser assigns that reference.' : 'Your nickname is not proof of identity. Your organiser will see this as an unverified code join.'}</p>
    <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={mutation.isPending}>
      <RequestError error={mutation.error} />
      <fieldset disabled={mutation.isPending || suggesting} className="space-y-4">
        <TextField label="Your nickname" name="nickname" value={existing ? preview.suggestedNickname : nickname} onChange={event => setNickname(event.target.value)} required maxLength={32} readOnly={existing} hint={existing ? 'This browser has already joined. Its nickname and identity cannot be reassigned.' : 'Unique in this room, ignoring capitalisation. It stays fixed after joining.'} />
        {!existing && <Button variant="secondary" size="sm" disabled={suggesting} onClick={() => { void suggest() }}>{suggesting ? 'Finding a name…' : 'Suggest another name'}</Button>}
        <Button type="submit" disabled={mutation.isPending || suggesting || (!existing && preview.room.participantCount >= 50)} className="w-full">{mutation.isPending ? 'Joining…' : existing ? 'Return to your room' : preview.room.participantCount >= 50 ? 'Room full' : 'Join room'}</Button>
      </fieldset>
      <p className="text-xs leading-relaxed text-muted">Return in this browser to keep the same participant record. Clearing cookies or switching browsers loses that access; a used invitation cannot be claimed again.</p>
    </form>
  </Card>
}
