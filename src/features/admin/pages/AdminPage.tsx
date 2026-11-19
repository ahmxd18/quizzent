import { useState, type FormEvent } from 'react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { RequestError } from '../../../components/ui/RequestError'
import { TextField } from '../../../components/ui/TextField'
import { useSession } from '../../auth/hooks/useSession'
import type { AdminAction } from '../api/admin'
import { AdminActionDialog } from '../components/AdminActionDialog'
import { AdminAccounts, AdminAudit, AdminRooms } from '../components/AdminLists'
import { useAdminOverview } from '../hooks/useAdmin'
import { notify } from '../../../lib/notifications'

function AdminDashboard({ userId }: { userId: string }) {
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<AdminAction | null>(null)
  const query = useAdminOverview(userId, search)

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = new FormData(event.currentTarget).get('search')
    setSearch(String(input ?? '').trim())
  }

  return <div className="mx-auto max-w-5xl space-y-8">
    <div>
      <ButtonLink to="/organiser" variant="ghost" size="sm">← Organiser space</ButtonLink>
      <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">Superadmin</h1>
      <ButtonLink to="/admin/directory" variant="secondary" className="mt-4">View competitions and rooms</ButtonLink>
    </div>
    <form onSubmit={filter} className="flex flex-wrap items-end gap-3">
      <TextField label="Search accounts and rooms" name="search" type="search" maxLength={100}
        placeholder="Name, email, room title, or code" />
      <Button type="submit" variant="secondary">Search</Button>
    </form>
    {query.isError ? <div className="space-y-3">
      <RequestError error={query.error} />
      <Button variant="secondary" onClick={() => { void query.refetch() }}>Retry admin overview</Button>
    </div> : query.data ? <>
      <AdminAccounts accounts={query.data.accounts} viewerId={userId} select={setSelection} />
      <AdminRooms rooms={query.data.rooms} select={setSelection} />
      <AdminAudit actions={query.data.actions} />
    </> : <p role="status" className="text-sm text-muted">Loading admin overview…</p>}
    {selection && <AdminActionDialog action={selection} dismiss={() => setSelection(null)}
      onSaved={saved => { notify.success(saved); setSelection(null) }} />}
  </div>
}

export function AdminPage() {
  const { data: user } = useSession()
  return <PageContainer className="py-10 sm:py-14">
    {user?.role === 'superadmin' ? <AdminDashboard key={user.id} userId={user.id} /> : (
      <Card className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="font-display text-3xl">Superadmin access required</h1>
        <ButtonLink to="/organiser" variant="secondary">Return to organiser space</ButtonLink>
      </Card>
    )}
  </PageContainer>
}
