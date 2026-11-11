import { Navigate, Outlet } from 'react-router'
import { useSession } from '../hooks/useSession'
import { SessionFeedback } from './SessionFeedback'

export function RequireSession() {
  const session = useSession()
  if (session.isPending || session.isError) return <SessionFeedback isError={session.isError} onRetry={() => { void session.refetch() }} />
  if (!session.data) return <Navigate to="/login" replace />
  // This controls navigation only. API endpoints must also check sessions themselves.
  return <Outlet />
}
