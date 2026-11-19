import { Check, Timer, Users } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'

const questions = [
  { prompt: 'Which planet is known as the Red Planet?', answers: ['Venus', 'Mars', 'Jupiter', 'Neptune'], correct: 1 },
  { prompt: 'Which animal is the largest on Earth?', answers: ['Elephant', 'Giraffe', 'Blue whale', 'Hippopotamus'], correct: 2 },
]
const motionQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)')
const subscribeMotion = (listener: () => void) => {
  const media = motionQuery()
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

export function CompetitionPreview() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => motionQuery().matches)
  const [paused, setPaused] = useState(false)
  const [frame, setFrame] = useState(0)
  const questionIndex = Math.floor(frame / 3)
  const question = questions[questionIndex]
  const selected = frame % 3 > 0
  const transitioning = frame % 3 === 2
  useEffect(() => {
    if (paused || reducedMotion) return
    const timer = window.setTimeout(() => setFrame(current => (current + 1) % 6), transitioning ? 300 : 1800)
    return () => window.clearTimeout(timer)
  }, [frame, paused, reducedMotion, transitioning])
  return (
    <div className="relative mx-auto w-full max-w-md pb-7 pt-3 lg:ml-auto lg:mr-0">
      <div aria-hidden="true" className="absolute inset-x-3 bottom-8 top-3 rotate-3 rounded-card bg-accent" />
      <Card className="relative overflow-hidden shadow-card">
        <div className="flex items-center justify-between gap-3 bg-brand px-6 py-5 text-on-brand sm:px-8">
          <span className="text-xs font-semibold tracking-widest uppercase">A quick warm-up</span>
          <Badge tone="accent"><Timer size={13} aria-hidden="true" />10 sec limit</Badge>
        </div>
        <div className={`p-6 transition-[opacity,transform] duration-300 motion-reduce:transition-none sm:p-8 ${transitioning && !reducedMotion ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Sample question</p>
          <h2 className="mt-3 min-h-20 text-2xl font-semibold leading-snug tracking-tight">{question.prompt}</h2>
          <ol aria-label="Sample answer options" className="mt-7 space-y-3">
            {question.answers.map((answer, index) => (
              <li key={answer} className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors duration-300 motion-reduce:transition-none ${selected && index === question.correct ? 'border-brand bg-accent/50' : 'border-outline bg-surface'}`}>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-canvas text-xs text-muted">{String.fromCharCode(65 + index)}</span>
                <span>{answer}</span>
                {selected && index === question.correct && <><Check className="ml-auto text-brand" size={18} aria-hidden="true" /><span className="sr-only">Example selected answer</span></>}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted">
            <span>Sample {questionIndex + 1} of 2</span>
            {!reducedMotion && <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)} className="min-h-11 rounded-lg px-3 font-semibold text-brand">{paused ? 'Play preview' : 'Pause preview'}</button>}
            {reducedMotion && <button type="button" onClick={() => setFrame(frame < 3 ? 3 : 0)} className="min-h-11 rounded-lg px-3 font-semibold text-brand">Next sample</button>}
          </div>
        </div>
      </Card>
      <div className="absolute bottom-0 left-6 flex items-center gap-2 rounded-full border border-outline bg-surface px-5 py-3 text-xs font-semibold shadow-card">
        <Users size={16} className="text-brand" aria-hidden="true" /> Better with a little rivalry.
      </div>
    </div>
  )
}
