import { ArrowUpRight, Hash } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { TextField } from '../../../components/ui/TextField'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '../../auth/hooks/useSession'

export function JoinRoomPanel() {
  const { data: user, isPending } = useSession()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('roomCode') ?? '').replace(/[\s-]/g, '').toUpperCase()
    if (!/^[A-Z2-9]{8}$/.test(code)) { setError('Enter the eight-character code. Spaces and hyphens are ignored.'); inputRef.current?.focus(); return }
    setError('')
    navigate(`/join/${code}`)
  }
  return (
    <Card className="p-7 sm:p-10">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Hash aria-hidden="true" size={23} /></span>
        <Badge tone="accent">No account needed</Badge>
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Got a room code?</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">Find your organiser’s room, then choose a nickname. If you received a personal invitation, open that link instead.</p>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <TextField ref={inputRef} label="Room code" name="roomCode" required maxLength={12} placeholder="e.g. ABCD-EFGH" hint="Eight characters. Spaces and hyphens are optional." error={error} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        <Button type="submit" className="w-full">Find room <ArrowUpRight aria-hidden="true" size={17} /></Button>
      </form>
      <div className="mt-8 border-t border-outline pt-5 text-center">
        <p className="text-sm text-muted">Want to be the one asking the questions?</p>
        {!isPending && <ButtonLink to={user ? '/organiser' : '/signup'} variant="ghost" size="sm" className="mt-2">{user ? 'Go to my space' : 'Become an organiser'} <ArrowUpRight aria-hidden="true" size={15} /></ButtonLink>}
      </div>
    </Card>
  )
}
