import { ArrowRight, Flag, Hash, MousePointer2 } from 'lucide-react'
import { ButtonLink } from '../../../components/ui/Button'

const steps = [
  { number: '01', icon: Hash, title: 'Find your room.', description: 'Get a code from your organiser. Pick a name and join the crew.' },
  { number: '02', icon: MousePointer2, title: 'Trust your knowledge.', description: 'One question at a time, in your own order. Make each answer count.' },
  { number: '03', icon: Flag, title: 'See where you stand.', description: 'Correct answers come first. Speed settles the tie. Let the results speak.' },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="border-t border-outline pb-16 pt-10 sm:pb-20 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Simple by design</p>
          <h2 id="how-heading" className="mt-3 text-3xl font-semibold tracking-tight">Less setup. More game.</h2>
        </div>
        <ButtonLink to="/signup" variant="ghost" size="sm">Bring your own questions <ArrowRight size={16} aria-hidden="true" /></ButtonLink>
      </div>
      <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
        {steps.map(({ number, icon: Icon, title, description }) => (
          <li key={number}>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon size={19} aria-hidden="true" /></span>
              <span className="font-display text-xl italic text-muted">{number}</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold">{title}</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
