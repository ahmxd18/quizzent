import { useParams } from 'react-router'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ApiError } from '../../../lib/http'
import { CompetitionEditor } from '../components/CompetitionEditor'
import { useCompetition } from '../hooks/useCompetitions'

export function EditCompetitionPage() {
  const { id = '' } = useParams()
  const query = useCompetition(id)
  // Keep the mounted form on background refreshes, preserving the user's input.
  if (query.data) return <CompetitionEditor key={id} competition={query.data.competition} />
  const missing = query.error instanceof ApiError && [400, 404].includes(query.error.status)
  return (
    <PageContainer className="py-16 text-center">
      {query.isPending ? <p role="status" className="text-muted">Loading your draft…</p> : <>
        <h1 className="font-display text-3xl">{missing ? 'We couldn’t find that draft.' : 'Your draft couldn’t be loaded.'}</h1>
        <p role="alert" className="mt-4 text-sm text-muted">{missing ? 'It may not exist, or it may belong to another organiser.' : 'Check your connection and try again.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!missing && <Button onClick={() => { void query.refetch() }}>Try again</Button>}
          <ButtonLink to="/organiser" variant="secondary">Your competitions</ButtonLink>
        </div>
      </>}
    </PageContainer>
  )
}
