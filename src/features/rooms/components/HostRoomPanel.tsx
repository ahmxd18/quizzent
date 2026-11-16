import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { RequestError } from '../../../components/ui/RequestError'
import { TextField } from '../../../components/ui/TextField'
import type { AdmissionMode } from '../api/rooms'
import { useCreateRoom, useRooms } from '../hooks/useRooms'

export function HostRoomPanel({ competitionId }: { competitionId: string }) {
  const rooms = useRooms()
  const mutation = useCreateRoom()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AdmissionMode>('open')
  const active = rooms.data?.rooms.find(room => room.status === 'open')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const data = new FormData(event.currentTarget)
    const lobbySeconds = Number(data.get('lobbySeconds'))
    const minReady = Number(data.get('minReady'))
    mutation.mutate({ competitionId, admissionMode: mode, lobbySeconds, minReady }, {
      onSuccess: ({ room }) => navigate(`/organiser/rooms/${room.id}`),
    })
  }
  return <Card className="mt-6 p-6 sm:p-8">
    <h2 className="text-xl font-semibold">Bring your guests together.</h2>
    {rooms.isPending ? <p role="status" className="mt-4 text-sm text-muted">Checking your rooms…</p> : active ? <div className="mt-4"><p className="text-sm text-muted">You already have an open room: {active.title}.</p><ButtonLink to={`/organiser/rooms/${active.id}`} className="mt-5">Go to your open room</ButtonLink></div> : rooms.isError ? <div className="mt-4"><RequestError error={rooms.error} /><Button onClick={() => { void rooms.refetch() }} className="mt-4">Try again</Button></div> : <form onSubmit={submit} className="mt-5 space-y-5">
      <RequestError error={mutation.error} />
      <fieldset disabled={mutation.isPending} className="space-y-3">
        <legend className="mb-3 text-sm font-semibold">Who can join?</legend>
        {(['open', 'invitation'] as const).map(value => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${mode === value ? 'border-brand bg-brand-soft' : 'border-control'}`}>
          <input type="radio" name="admissionMode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 size-4 shrink-0 accent-brand" />
          <span><span className="block text-sm font-semibold">{value === 'open' ? 'Anyone with the room code' : 'Personal invitations only'}</span><span className="mt-1 block text-sm leading-relaxed text-muted">{value === 'open' ? 'Code joins are unverified. You can also create personal invitations for named guests.' : 'Each guest needs a private link tied to a reference you assign.'}</span></span>
        </label>)}
      </fieldset>
      <fieldset disabled={mutation.isPending} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">When can the competition start?</legend>
        <TextField label="Lobby countdown (seconds)" name="lobbySeconds" type="number" required min={0} max={3600} step={1} defaultValue={60} hint="Use 0 to wait only for the ready minimum." />
        <TextField label="Minimum ready guests" name="minReady" type="number" required min={1} max={50} step={1} defaultValue={2} hint="Only guests who are online and ready count." />
      </fieldset>
      <div className="flex flex-wrap items-center gap-4"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Opening room…' : 'Open room'}</Button><span className="text-xs text-muted">Up to 50 guests · One open room at a time</span></div>
    </form>}
  </Card>
}
