import { ArrowLeft, LockKeyhole, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import type { Competition } from '../api/competitions'
import { CompetitionForm } from './CompetitionForm'

export function CompetitionEditor({ competition }: { competition?: Competition }) {
  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link to="/organiser" className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-muted hover:text-brand"><ArrowLeft size={16} aria-hidden="true" />Your competitions</Link>
        <div className="mb-8 mt-7">
          <Badge tone="accent">Private draft</Badge>
          <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">{competition ? 'Make it your own.' : 'Start with a little curiosity.'}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{competition ? 'Update your competition details and save when you’re ready.' : 'Name your competition, set its pace, and save your first draft.'}</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2"><CompetitionForm key={competition?.id ?? 'new'} competition={competition} /></div>
          <aside aria-label="About competition drafts" className="space-y-5">
            <Card className="p-6">
              <LockKeyhole size={22} className="text-brand" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold">A space to shape your idea.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">Only you can access this draft. Saving it won’t publish a competition or open a room.</p>
            </Card>
            <div className="rounded-2xl bg-brand-soft p-6">
              <Sparkles size={20} className="text-brand" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold">Next up: the questions.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">Question editing and publication will arrive in the next step. For now, get the basics ready.</p>
            </div>
          </aside>
        </div>
      </div>
    </PageContainer>
  )
}
