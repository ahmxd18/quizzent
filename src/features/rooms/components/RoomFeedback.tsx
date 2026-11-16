import { Button, ButtonLink } from '../../../components/ui/Button'
import { RequestError } from '../../../components/ui/RequestError'

export function RoomFeedback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return <div className="mx-auto max-w-lg py-12 text-center">{error ? <><RequestError error={error} /><div className="mt-5 flex flex-wrap justify-center gap-3"><Button onClick={onRetry}>Try again</Button><ButtonLink to="/join" variant="secondary">Enter a room code</ButtonLink></div></> : <p role="status" className="text-muted">Loading your room…</p>}</div>
}
