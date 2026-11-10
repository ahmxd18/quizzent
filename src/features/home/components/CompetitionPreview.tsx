import { Check, Timer, Users } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'

const answers = ['Venus', 'Mars', 'Jupiter', 'Neptune']

export function CompetitionPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md pb-7 pt-3 lg:ml-auto lg:mr-0">
      <div aria-hidden="true" className="absolute inset-x-3 bottom-8 top-3 rotate-3 rounded-card bg-accent" />
      <Card className="relative overflow-hidden shadow-card">
        <div className="flex items-center justify-between gap-3 bg-brand px-6 py-5 text-on-brand sm:px-8">
          <span className="text-xs font-semibold tracking-widest uppercase">A quick warm-up</span>
          <Badge tone="accent"><Timer size={13} aria-hidden="true" />10 sec limit</Badge>
        </div>
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Sample question</p>
          <h2 className="mt-3 text-2xl font-semibold leading-snug tracking-tight">Which planet is known as the Red Planet?</h2>
          <ol aria-label="Sample answer options" className="mt-7 space-y-3">
            {answers.map((answer, index) => (
              <li key={answer} className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${answer === 'Mars' ? 'border-brand bg-accent/50' : 'border-outline bg-surface'}`}>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-canvas text-xs text-muted">{String.fromCharCode(65 + index)}</span>
                <span>{answer}</span>
                {answer === 'Mars' && <><Check className="ml-auto text-brand" size={18} aria-hidden="true" /><span className="sr-only">Example selected answer</span></>}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-xs text-muted">A little preview of your next challenge.</p>
        </div>
      </Card>
      <div className="absolute bottom-0 left-6 flex items-center gap-2 rounded-full border border-outline bg-surface px-5 py-3 text-xs font-semibold shadow-card">
        <Users size={16} className="text-brand" aria-hidden="true" /> Better with a little rivalry.
      </div>
    </div>
  )
}
