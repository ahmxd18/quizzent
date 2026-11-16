import { useEffect, useState } from 'react'
import type { Room } from '../api/rooms'

type CountdownProps = {
  room: Pick<Room, 'lobbyEndsAt' | 'warningEndsAt' | 'minReady'>
  readyCount: number
  clockOffset: number
}

export function LobbyCountdown({ room, readyCount, clockOffset }: CountdownProps) {
  const [now, setNow] = useState(Date.now)
  const warningEndsAt = readyCount >= room.minReady ? room.warningEndsAt : null
  const warning = warningEndsAt !== null
  const endsAt = Date.parse(warningEndsAt ?? room.lobbyEndsAt)
  const seconds = Math.max(0, Math.ceil((endsAt - now - clockOffset) / 1000))

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [])

  const remaining = Math.max(0, room.minReady - readyCount)
  let label = 'Lobby countdown'
  if (warning) label = seconds ? 'Competition starts in' : 'Confirming the start…'
  else if (!seconds) label = remaining ? 'Waiting for ready guests' : 'Preparing the start warning…'

  return (
    <div className={`rounded-xl border p-4 ${warning ? 'border-accent bg-accent text-foreground' : 'border-outline bg-surface text-foreground'}`}>
      <p role="status" className="text-sm font-semibold">{label}</p>
      {seconds > 0 && (
        <p role="timer" className="mt-1 font-display text-3xl tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </p>
      )}
      {!warning && <p className="mt-1 text-sm text-muted">{readyCount} ready · Minimum {room.minReady}</p>}
    </div>
  )
}
