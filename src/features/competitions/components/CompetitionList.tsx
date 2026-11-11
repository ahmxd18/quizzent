import { Plus } from 'lucide-react'
import { useLocation } from 'react-router'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { useCompetitions } from '../hooks/useCompetitions'
import { CompetitionEmptyState } from './CompetitionEmptyState'
import { CompetitionListItem } from './CompetitionListItem'

export function CompetitionList() {
  const query = useCompetitions()
  const { state } = useLocation()
  const saved = state?.draftSaved === true
  const competitions = query.data?.competitions
  return (
    <section aria-labelledby="competition-library-title" className="mt-12">
      {saved && <p role="status" className="mb-6 rounded-xl border border-success bg-surface px-5 py-4 text-sm text-success">Your draft has been saved.</p>}
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="competition-library-title" className="text-2xl font-semibold tracking-tight">Your competitions</h2>
          <p className="mt-2 text-sm text-muted">Keep your next challenge ready.</p>
        </div>
        {competitions && competitions.length > 0 && <ButtonLink to="/organiser/competitions/new"><Plus size={17} aria-hidden="true" />Create competition</ButtonLink>}
      </div>
      <Card className="overflow-hidden">
        {query.isPending && <p role="status" className="p-8 text-sm text-muted">Loading your competitions…</p>}
        {query.isError && <div className="p-8"><p role="alert" className="text-sm text-danger">We couldn’t load your latest competitions.</p><Button variant="secondary" size="sm" className="mt-4" onClick={() => { void query.refetch() }}>Try again</Button></div>}
        {competitions?.length === 0 && <CompetitionEmptyState />}
        {competitions && competitions.length > 0 && <ul className="divide-y divide-outline p-2">{competitions.map(competition => <CompetitionListItem key={competition.id} competition={competition} />)}</ul>}
      </Card>
    </section>
  )
}
