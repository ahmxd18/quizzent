import { Button } from '../../../components/ui/Button'
import { useLiveLobby } from '../hooks/useLiveLobby'
import { LobbyConnection } from './LobbyConnection'

export function GuestReadiness({ roomId }: { roomId: string }) {
  const lobby = useLiveLobby(roomId, 'guest', true)
  const ready = lobby.state && 'ready' in lobby.state ? lobby.state.ready : undefined

  return (
    <section aria-label="Lobby readiness" className="mt-6 space-y-4 rounded-2xl border border-outline bg-surface-strong p-4 sm:p-5">
      <LobbyConnection connection={lobby.connection} onRetry={lobby.reconnect} />
      <p className="text-sm text-muted" role="status">
        {ready === undefined ? 'Readiness is available when connected.' : ready ? 'You’re ready.' : 'Mark yourself ready when you’re set to play.'}
      </p>
      <Button
        className="w-full"
        variant={ready ? 'secondary' : 'accent'}
        disabled={ready === undefined || lobby.updating}
        onClick={() => { void lobby.setReady(!ready) }}
      >
        {lobby.updating ? 'Updating…' : ready ? 'Mark as not ready' : 'I’m ready'}
      </Button>
      {lobby.state && <p className="text-sm text-muted">{lobby.state.readyCount} ready · {lobby.state.onlineCount} online</p>}
      {lobby.actionError && <p className="text-sm font-semibold text-brand" role="alert">{lobby.actionError}</p>}
    </section>
  )
}
