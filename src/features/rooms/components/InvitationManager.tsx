import { useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { CopyButton } from '../../../components/ui/CopyButton'
import { RequestError } from '../../../components/ui/RequestError'
import { TextField } from '../../../components/ui/TextField'
import { personalJoinLink, type Invitation, type InvitationLink, type Room } from '../api/rooms'
import { useRoomActions } from '../hooks/useRooms'

export function InvitationManager({ room, invitations }: { room: Room; invitations: Invitation[] }) {
  const actions = useRoomActions(room.id)
  const [reference, setReference] = useState('')
  const [link, setLink] = useState<{ reference: string; url: string } | null>(null)
  const [replacing, setReplacing] = useState<Invitation | null>(null)
  const busy = actions.invite.isPending || actions.renew.isPending
  const open = room.status === 'open'
  function showLink(result: InvitationLink) {
    setLink({ reference: result.invitation.reference, url: personalJoinLink(room, result.token) })
    // Links stay only in this panel's memory; do not retain raw invitation tokens in the query cache.
    actions.invite.reset()
    actions.renew.reset()
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    actions.renew.reset()
    actions.invite.mutate(reference, { onSuccess: result => { setReference(''); showLink(result) } })
  }
  return <section aria-labelledby="invitations-title" className="space-y-5">
    <div><h2 id="invitations-title" className="text-2xl font-semibold">Personal invitations</h2><p className="mt-2 text-sm leading-relaxed text-muted">Assign a reference you recognise, then send the private link to that person. A forwarded link can be used by someone else. Invitations do not reserve places.</p></div>
    <RequestError error={actions.invite.error ?? actions.renew.error} />
    {open && <Card className="p-6"><form onSubmit={submit} className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
      <div className="w-full flex-1"><TextField label="Organiser reference" name="reference" value={reference} onChange={event => setReference(event.target.value)} required maxLength={100} disabled={busy || invitations.length >= 50} placeholder="e.g. John · Student 1042" hint="Guests cannot edit this. Use a unique reference within this room." /></div>
      <Button type="submit" disabled={busy || invitations.length >= 50}>{actions.invite.isPending ? 'Creating…' : 'Create invitation'}</Button>
    </form>{invitations.length >= 50 && <p className="mt-4 text-sm text-muted">This room has reached its 50-invitation limit.</p>}</Card>}
    {open && link && <Card className="border-brand p-6"><p role="status" className="text-sm font-semibold text-brand">Private link ready for {link.reference}</p><p className="mt-2 text-sm leading-relaxed text-muted">Copy it now and share it only with the intended guest. Only a hash is stored, so the link cannot be displayed again after you leave this page.</p><TextField className="mt-3" label="Personal invitation link" value={link.url} readOnly onFocus={event => event.target.select()} /><div className="mt-4 flex flex-wrap items-center gap-3"><CopyButton value={link.url} label="Copy personal link" /><Button variant="ghost" size="sm" onClick={() => setLink(null)}>Hide link</Button></div></Card>}
    <Card className="overflow-hidden"><ul className="divide-y divide-outline">{invitations.map(invitation => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="break-words text-sm font-semibold">{invitation.reference}</p><Badge tone={invitation.participantId ? 'accent' : 'neutral'} className="mt-2">{invitation.participantId ? 'Joined' : open ? 'Not used yet' : 'Room closed'}</Badge></div>{open && !invitation.participantId && <Button variant="secondary" size="sm" disabled={busy} onClick={() => { actions.invite.reset(); actions.renew.reset(); setReplacing(invitation) }} aria-label={`New link for ${invitation.reference}`}>New link</Button>}</li>)}</ul>{invitations.length === 0 && <p className="p-6 text-sm text-muted">No personal invitations yet.</p>}</Card>
    <ConfirmDialog open={!!replacing} title="Replace this invitation link?" description="The previous unused link will stop working. Copy and share the replacement with the intended person." confirmLabel="Replace link" cancelLabel="Keep current link" pending={actions.renew.isPending} onCancel={() => setReplacing(null)} onConfirm={() => { if (replacing && !busy) actions.renew.mutate(replacing.id, { onSuccess: result => { setReplacing(null); showLink(result) }, onError: () => setReplacing(null) }) }} />
  </section>
}
