import { Button } from '../../../components/ui/Button'
import { ApiError } from '../../../lib/http'
import { useLogout } from '../../auth/hooks/useLogout'
import type { SessionUser } from '../../auth/api/session'
import { CompetitionList } from '../../competitions/components/CompetitionList'

export function OrganiserOverview({ user }: { user: SessionUser }) {
  const logout = useLogout()
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold text-brand">Organiser space</p>
      <h1 className="mt-3 break-words font-display text-4xl tracking-tight sm:text-5xl">Welcome, {user.displayName}.</h1>
      <p className="mt-4 break-words text-muted">Signed in as {user.email}</p>
      <CompetitionList />
      {logout.error && <p role="alert" className="mt-6 text-sm text-danger">{logout.error instanceof ApiError ? logout.error.message : 'Could not log out. Check your connection and try again.'}</p>}
      <Button variant="secondary" disabled={logout.isPending} onClick={() => logout.mutate()} className="mt-7">{logout.isPending ? 'Logging out…' : 'Log out'}</Button>
    </div>
  )
}
