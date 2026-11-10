import { ArrowUpRight, Check } from 'lucide-react'
import { ButtonLink } from '../../../components/ui/Button'
import { CompetitionPreview } from './CompetitionPreview'

export function HomeHero() {
  return (
    <section aria-labelledby="home-heading" className="grid items-center gap-14 pb-20 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-24 lg:pt-20">
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-brand uppercase">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" /> A little friendly competition
        </p>
        <h1 id="home-heading" className="mt-6 text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl xl:text-7xl">
          Sharp minds.<br /><span className="font-display font-normal italic text-brand">Good times.</span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
          Your people. A room code. A little friendly rivalry. Bring everyone together and turn what you know into a great competition.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/join">Join a room <ArrowUpRight size={18} aria-hidden="true" /></ButtonLink>
          <ButtonLink to="/signup" variant="secondary">Host a competition</ButtonLink>
        </div>
        <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-muted">
          <li className="inline-flex items-center gap-1.5"><Check size={15} className="text-brand" aria-hidden="true" /> No account needed to play</li>
          <li className="inline-flex items-center gap-1.5"><Check size={15} className="text-brand" aria-hidden="true" /> Your own question order</li>
        </ul>
      </div>
      <CompetitionPreview />
    </section>
  )
}
