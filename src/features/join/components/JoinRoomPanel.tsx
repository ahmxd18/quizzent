import { ArrowUpRight, Hash } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { TextField } from '../../../components/ui/TextField'

export function JoinRoomPanel() {
  return (
    <Card className="p-7 sm:p-10">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Hash aria-hidden="true" size={23} /></span>
        <Badge>Coming soon</Badge>
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Got a room code?</h1>
      <p id="join-availability" className="mt-3 text-sm leading-relaxed text-muted">Room joining is on its way. Soon, your organiser's code will be all you need to get started.</p>
      <fieldset disabled aria-describedby="join-availability" className="mt-7 space-y-5">
        <TextField label="Room code" name="roomCode" placeholder="Your organiser’s code" hint="No account needed. You’ll choose your name in the room." autoComplete="off" />
        <Button disabled className="w-full">Join the room <ArrowUpRight aria-hidden="true" size={17} /></Button>
      </fieldset>
      <div className="mt-8 border-t border-outline pt-5 text-center">
        <p className="text-sm text-muted">Want to be the one asking the questions?</p>
        <ButtonLink to="/signup" variant="ghost" size="sm" className="mt-2">Become an organiser <ArrowUpRight aria-hidden="true" size={15} /></ButtonLink>
      </div>
    </Card>
  )
}
