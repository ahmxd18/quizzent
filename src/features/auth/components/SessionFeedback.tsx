import { Button } from '../../../components/ui/Button'

export function SessionFeedback({ isError, onRetry }: { isError: boolean; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      {isError ? <>
        <p role="alert" className="text-danger">We couldn’t check your session. Please try again.</p>
        <Button onClick={onRetry} className="mt-5">Try again</Button>
      </> : <p role="status" className="text-muted">Checking your session…</p>}
    </div>
  )
}
