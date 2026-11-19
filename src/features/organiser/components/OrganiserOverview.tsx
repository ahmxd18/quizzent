import { ButtonLink } from '../../../components/ui/Button'
import type { SessionUser } from '../../auth/api/session'
import { CompetitionList } from '../../competitions/components/CompetitionList'
import { RoomList } from '../../rooms/components/RoomList'

export function OrganiserOverview({ user }: { user: SessionUser }) {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold text-brand">Organiser space</p>
      <h1 className="mt-3 break-words font-display text-4xl tracking-tight sm:text-5xl">Welcome, {user.displayName}.</h1>
      <p className="mt-4 break-words text-muted">Signed in as {user.email}</p>
      {user.role === 'superadmin' && <ButtonLink to="/admin" variant="secondary" className="mt-5">Admin controls</ButtonLink>}
      <RoomList />
      <CompetitionList />
    </div>
  )
}
