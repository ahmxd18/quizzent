import { useEffect, useState, type FormEvent } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { MultiSelect } from '../../../components/ui/MultiSelect'
import { Select, type SelectOption } from '../../../components/ui/Select'
import { Badge } from '../../../components/ui/Badge'
import { TextField } from '../../../components/ui/TextField'
import { RequestError } from '../../../components/ui/RequestError'
import { ApiError } from '../../../lib/http'
import { sessionKey, useSession } from '../../auth/hooks/useSession'
import { directoryStatuses, getDirectory, getOrganiserOptions, type DirectoryFilters } from '../api/admin'

const initial = { status: '', organisers: [], search: '', startDate: '', endDate: '', page: 1, pageSize: 10 }
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

function Directory({ userId }: { userId: string }) {
  const client = useQueryClient()
  const [organisers, setOrganisers] = useState<SelectOption[]>([])
  const [searchOrganisers, setSearchOrganisers] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchOrganisers), 250)
    return () => window.clearTimeout(timer)
  }, [searchOrganisers])
  const options = useInfiniteQuery({
    queryKey: ['admin', 'organisers', userId, debouncedSearch],
    queryFn: ({ pageParam }) => getOrganiserOptions(debouncedSearch, pageParam),
    initialPageParam: 1, retry: false, gcTime: 0,
    getNextPageParam: (last, pages) => last.hasNextPage ? pages.length + 1 : undefined,
  })
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
    setFilters({ status: String(fields.get('status') ?? ''), organisers: organisers.map(item => item.value),
      search: String(fields.get('search') ?? '').trim(), startDate, endDate, page: 1, pageSize: filters.pageSize })
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <div>
      <ButtonLink to="/admin" variant="ghost" size="sm">← Admin controls</ButtonLink>
      <h1 className="mt-4 font-display text-4xl">Competitions and rooms</h1>
      <p className="mt-2 text-sm text-muted">Dates use UTC and refer to competition creation or room opening.</p>
    </div>
    <Card className="p-5">
      <form onSubmit={applyFilters} onReset={() => { setError(''); setFilters(initial); setOrganisers([]); setSearchOrganisers('') }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Status" name="status" options={[{ value: '', label: 'All statuses' }, ...Object.entries(directoryStatuses).map(([value, label]) => ({ value, label }))]} />
          <MultiSelect label="Organisers" selected={organisers} onChange={setOrganisers}
            options={options.data?.pages.flatMap(page => page.options) ?? []}
            search={searchOrganisers} onSearch={setSearchOrganisers}
            loading={options.isFetching} hasMore={options.hasNextPage}
            onLoadMore={() => { void options.fetchNextPage() }}
            error={options.error ? 'Could not load organisers.' : undefined}
            onRetry={() => { void options.refetch() }} />
          <TextField label="Search" name="search" type="search" maxLength={100} placeholder="Title, room code, or organiser" />
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
        {query.data.records.length ? <div role="region" aria-label="Directory table" tabIndex={0} className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-outline bg-surface-strong text-muted"><tr>
            <th scope="col" className="p-4">Competition / room</th><th scope="col" className="p-4">Organiser</th>
            <th scope="col" className="p-4">Status</th><th scope="col" className="p-4">Created (UTC)</th>
          </tr></thead>
          <tbody className="divide-y divide-outline">{query.data.records.map(record => (
            <tr key={`${record.kind}:${record.id}`}>
              <td className="max-w-60 break-words p-4"><p className="font-semibold">{record.title}</p><p className="text-muted">{record.code ? `Room ${record.code}` : 'Competition'}</p></td>
              <td className="max-w-56 break-words p-4">{record.organiserName}<br /><span className="text-muted">{record.organiserEmail}</span></td>
              <td className="p-4"><Badge>{directoryStatuses[record.status]}</Badge></td>
              <td className="p-4">{dateFormat.format(new Date(record.createdAt))}</td>
            </tr>
          ))}</tbody>
        </table></div> : <p className="p-5 text-sm text-muted">No matching competitions or rooms.</p>}
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Select label="Rows per page" value={filters.pageSize}
          onChange={event => setFilters({ ...filters, page: 1, pageSize: Number(event.target.value) })}
          options={[10, 25, 50, 100].map(size => ({ value: String(size), label: String(size) }))} />
        <Button size="sm" variant="secondary" disabled={filters.page === 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</Button>
        <span className="text-sm text-muted" role="status">Page {filters.page} of {Math.max(1, query.data.pagination.totalPages)} · {query.data.pagination.totalElements} records</span>
        <Button size="sm" variant="secondary" disabled={filters.page >= query.data.pagination.totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</Button>
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
