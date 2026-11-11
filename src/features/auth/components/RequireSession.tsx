import { Navigate, Outlet } from 'react-router'
import { useSession } from '../hooks/useSession'
import { SessionFeedback } from './SessionFeedback'

export function RequireSession() {
  const session = useSession()
  // A failed background check must not unmount an editor and discard unsaved work.
  if (session.isPending || (session.isError && !session.data)) return <SessionFeedback isError={session.isError} onRetry={() => { void session.refetch() }} />
  if (!session.data) return <Navigate to="/login" replace />
  // This controls navigation only. API endpoints must also check sessions themselves.
  return <Outlet />
}
