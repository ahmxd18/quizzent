import { useEffect, useId, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { TextField } from '../../../components/ui/TextField'
import { RequestError } from '../../../components/ui/RequestError'
import { ApiError } from '../../../lib/http'
import { sessionKey, useSession } from '../../auth/hooks/useSession'
import { directoryStatuses, getDirectory, type DirectoryFilters } from '../api/admin'

const initial = { status: '', organiser: '', startDate: '', endDate: '', page: 1 }
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

function Directory({ userId }: { userId: string }) {
  const client = useQueryClient()
  const statusId = useId()
  const [filters, setFilters] = useState<DirectoryFilters>(initial)
  const [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['admin', 'directory', userId, filters], queryFn: () => getDirectory(filters), gcTime: 0, retry: false,
  })
  useEffect(() => {
    if (query.error instanceof ApiError && [401, 403].includes(query.error.status)) {
      void client.invalidateQueries({ queryKey: sessionKey })
    }
  }, [client, query.error])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const startDate = String(fields.get('startDate') ?? '')
    const endDate = String(fields.get('endDate') ?? '')
    if (startDate && endDate && startDate > endDate) {
      setError('Start date must be on or before end date.')
      return
    }
    setError('')
    setFilters({ status: String(fields.get('status') ?? ''), organiser: String(fields.get('organiser') ?? '').trim(), startDate, endDate, page: 1 })
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <div>
      <ButtonLink to="/admin" variant="ghost" size="sm">← Admin controls</ButtonLink>
      <h1 className="mt-4 font-display text-4xl">Competitions and rooms</h1>
      <p className="mt-2 text-sm text-muted">Dates use UTC and refer to competition creation or room opening.</p>
    </div>
    <Card className="p-5">
      <form onSubmit={applyFilters} onReset={() => { setError(''); setFilters(initial) }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label htmlFor={statusId} className="block text-sm font-semibold">Status</label>
            <select id={statusId} name="status" className="min-h-12 w-full rounded-xl border border-control bg-surface px-3 text-sm text-foreground">
              <option value="">All statuses</option>
              {Object.entries(directoryStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <TextField label="Organiser email" name="organiser" type="email" maxLength={254} />
          <TextField label="Start date" name="startDate" type="date" />
          <TextField label="End date" name="endDate" type="date" error={error || undefined} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Apply filters</Button>
          <Button type="reset" variant="secondary">Reset filters</Button>
        </div>
      </form>
    </Card>
    <RequestError error={query.error} />
    {query.isError && <Button variant="secondary" onClick={() => { void query.refetch() }}>Retry directory</Button>}
    {query.isPending && <p role="status" className="text-sm text-muted">Loading competitions and rooms…</p>}
    {query.data && <>
      <Card className="overflow-hidden">
        {query.data.records.length ? <ul className="divide-y divide-outline">{query.data.records.map(record => (
          <li key={`${record.kind}:${record.id}`} className="flex flex-wrap items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="break-words font-semibold">{record.title}</p>
              <p className="break-words text-sm text-muted">{record.organiserName} · {record.organiserEmail}</p>
              <p className="mt-1 break-words text-sm text-muted">{record.code ? `Room ${record.code}` : 'Competition'} · {dateFormat.format(new Date(record.createdAt))}</p>
            </div>
            <Badge>{directoryStatuses[record.status]}</Badge>
          </li>
        ))}</ul> : <p className="p-5 text-sm text-muted">No matching competitions or rooms.</p>}
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" disabled={filters.page === 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</Button>
        <span className="text-sm text-muted">Page {filters.page}</span>
        <Button size="sm" variant="secondary" disabled={!query.data.hasNextPage} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</Button>
      </div>
    </>}
  </div>
}

export function AdminDirectoryPage() {
  const { data: user } = useSession()
  return <PageContainer className="py-10 sm:py-14">
    {user?.role === 'superadmin' ? <Directory key={user.id} userId={user.id} /> : (
      <Card className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="font-display text-3xl">Superadmin access required</h1>
        <ButtonLink to="/organiser" variant="secondary">Return to organiser space</ButtonLink>
      </Card>
    )}
  </PageContainer>
}
