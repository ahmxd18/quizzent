import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type { LobbyConnection as Connection } from '../hooks/useLiveLobby'

const labels: Record<Connection, string> = {
  connecting: 'Connecting to live lobby…',
  live: 'Live lobby connected',
  reconnecting: 'Reconnecting to live lobby…',
  unavailable: 'Live lobby unavailable',
}

export function LobbyConnection({ connection, onRetry }: { connection: Connection; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge role="status" tone={connection === 'live' ? 'brand' : 'neutral'}>{labels[connection]}</Badge>
      {connection === 'unavailable' && <Button variant="secondary" size="sm" onClick={onRetry}>Retry live connection</Button>}
    </div>
  )
}
