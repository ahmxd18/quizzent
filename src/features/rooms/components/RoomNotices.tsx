import type { Room } from '../api/rooms'

export function RoomConnectionNotice() {
  return (
    <p role="status" className="rounded-xl border border-outline bg-surface-strong p-4 text-sm text-foreground">
      Connection to Quizzent lost. Reconnecting…
    </p>
  )
}

export function CancellationNotice({ room }: { room: Room }) {
  if (!room.cancellationReason) return null
  return (
    <section role="status" className="space-y-2 rounded-xl border border-danger bg-surface p-5">
      <h2 className="font-display text-2xl">Competition cancelled</h2>
      <p className="break-words text-sm leading-relaxed text-muted">
        {room.cancellationReason === 'server_outage'
          ? 'The server went down while this competition was running.'
          : room.cancellationNote ?? (room.cancellationReason === 'superadmin'
            ? 'A superadmin cancelled this competition.' : 'The organiser cancelled this competition.')}
      </p>
    </section>
  )
}
