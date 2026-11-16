import { ArrowLeft, LockKeyhole, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { ButtonLink } from '../../../components/ui/Button'
import type { Competition } from '../api/competitions'
import { CompetitionForm } from './CompetitionForm'

export function CompetitionEditor({ competition }: { competition?: Competition }) {
  const published = competition?.status === 'published'
  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link to="/organiser" className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-muted hover:text-brand"><ArrowLeft size={16} aria-hidden="true" />Your competitions</Link>
        <div className="mb-8 mt-7">
          <Badge tone="accent">{published ? 'Published · read only' : 'Private draft'}</Badge>
          <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">{published ? 'Your challenge is ready.' : competition ? 'Make it your own.' : 'Start with a little curiosity.'}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{published ? 'Content and timing are locked. Opening a live room comes in the next step.' : competition ? 'Update your competition details and save when you’re ready.' : 'Name your competition, set its pace, and save your first draft.'}</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">{published && competition ? <Card className="space-y-5 p-7"><h2 className="break-words text-2xl font-semibold">{competition.title}</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">{competition.description || 'No description.'}</p><p className="text-sm">{competition.questionTimeSeconds} seconds per question</p></Card> : <CompetitionForm key={competition?.id ?? 'new'} competition={competition} />}</div>
          <aside aria-label="About competition drafts" className="space-y-5">
            <Card className="p-6">
              <LockKeyhole size={22} className="text-brand" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold">A space to shape your idea.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{published ? 'Your published content stays available here for review. It can no longer be edited.' : 'Only you can access this draft. Saving it won’t publish a competition or open a room.'}</p>
            </Card>
            <div className="rounded-2xl bg-brand-soft p-6">
              <Sparkles size={20} className="text-brand" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold">{published ? 'Review your questions.' : 'Give curiosity a challenge.'}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{competition ? 'Manage your questions and review their correct answers in your organiser workspace.' : 'Save the basics first. Then add your questions and choose the correct answers.'}</p>
              {competition && <ButtonLink to={`/organiser/competitions/${competition.id}/questions`} size="sm" className="mt-5">{published ? 'View questions' : 'Manage questions'}</ButtonLink>}
            </div>
          </aside>
        </div>
      </div>
    </PageContainer>
  )
}
