import { Navigate, Outlet } from 'react-router'
import { useSession } from '../hooks/useSession'
import { SessionFeedback } from './SessionFeedback'

export function RequireGuest() {
  const session = useSession()
  if (session.data) return <Navigate to="/organiser" replace />
  if (session.isPending || session.isError) return <SessionFeedback isError={session.isError} onRetry={() => { void session.refetch() }} />
  return <Outlet />
}
