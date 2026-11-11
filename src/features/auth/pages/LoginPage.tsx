import { PageContainer } from '../../../components/layout/PageContainer'
import { Navigate } from 'react-router'
import { LoginPanel } from '../components/LoginPanel'
import { SessionFeedback } from '../components/SessionFeedback'
import { useSession } from '../hooks/useSession'

export function LoginPage() {
  const session = useSession()
  if (session.isPending || session.isError) return <PageContainer><SessionFeedback isError={session.isError} onRetry={() => { void session.refetch() }} /></PageContainer>
  if (session.data) return <Navigate to="/organiser" replace />
  return <PageContainer className="py-12 sm:py-16"><div className="mx-auto max-w-lg"><LoginPanel /></div></PageContainer>
}
