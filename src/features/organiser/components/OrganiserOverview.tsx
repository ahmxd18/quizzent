import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ApiError } from '../../../lib/http'
import { useLogout } from '../../auth/hooks/useLogout'
import type { SessionUser } from '../../auth/api/session'

export function OrganiserOverview({ user }: { user: SessionUser }) {
  const logout = useLogout()
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-brand">Organiser space</p>
      <h1 className="mt-3 break-words font-display text-4xl tracking-tight sm:text-5xl">Welcome, {user.displayName}.</h1>
      <p className="mt-4 break-words text-muted">Signed in as {user.email}</p>
      <Card className="mt-8 p-7 sm:p-10">
        <h2 className="text-xl font-semibold">Your next quiz starts here.</h2>
        <p className="mt-3 leading-relaxed text-muted">Your organiser account is ready. Creating and managing competition drafts is coming next.</p>
      </Card>
      {logout.error && <p role="alert" className="mt-6 text-sm text-danger">{logout.error instanceof ApiError ? logout.error.message : 'Could not log out. Check your connection and try again.'}</p>}
      <Button variant="secondary" disabled={logout.isPending} onClick={() => logout.mutate()} className="mt-7">{logout.isPending ? 'Logging out…' : 'Log out'}</Button>
    </div>
  )
}
