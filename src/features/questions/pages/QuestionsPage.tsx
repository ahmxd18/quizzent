import { Link, useParams } from 'react-router'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { ApiError } from '../../../lib/http'
import { useCompetition } from '../../competitions/hooks/useCompetitions'
import { QuestionWorkspace } from '../components/QuestionWorkspace'

export function QuestionsPage() {
  const { id = '' } = useParams()
  const query = useCompetition(id)
  const competition = query.data?.competition
  if (!competition) return <PageContainer className="py-16 text-center">
    {query.isPending ? <p role="status">Loading your competition…</p> : <><h1 className="font-display text-3xl">{query.error instanceof ApiError && [400, 404].includes(query.error.status) ? 'Competition not found.' : 'Couldn’t load your competition.'}</h1><Button variant="secondary" className="mt-5" onClick={() => { void query.refetch() }}>Try again</Button><ButtonLink to="/organiser" className="ml-3 mt-5">Your competitions</ButtonLink></>}
  </PageContainer>
  return <PageContainer className="py-10 sm:py-14"><div className="mx-auto max-w-4xl">
    <Link to="/organiser" className="rounded-sm text-sm font-semibold text-muted hover:text-brand">← Your competitions</Link>
    <div className="mb-9 mt-7">
      <Badge tone={competition.status === 'published' ? 'accent' : 'neutral'}>{competition.status === 'published' ? 'Published · read only' : 'Private draft'}</Badge>
      <h1 className="mt-4 break-words font-display text-4xl tracking-tight sm:text-5xl">{competition.title}</h1>
      <p className="mt-3 text-sm text-muted">{competition.questionTimeSeconds} seconds per question · Correct answers are visible only in your organiser workspace.</p>
      <ButtonLink to={`/organiser/competitions/${id}/edit`} variant="secondary" size="sm" className="mt-5">{competition.status === 'draft' ? 'Edit competition details' : 'View competition details'}</ButtonLink>
    </div>
    <QuestionWorkspace key={id} competition={competition} />
  </div></PageContainer>
}
