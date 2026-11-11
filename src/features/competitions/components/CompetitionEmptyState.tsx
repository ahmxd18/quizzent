import { ListPlus, Plus } from 'lucide-react'
import { ButtonLink } from '../../../components/ui/Button'

export function CompetitionEmptyState() {
  return (
    <div className="px-6 py-14 text-center sm:py-20">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent text-foreground"><ListPlus size={28} aria-hidden="true" /></span>
      <h3 className="mt-6 font-display text-3xl tracking-tight">Good quizzes start with an idea.</h3>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">Give your next competition a name and set its pace. Your draft stays private until you’re ready for more.</p>
      <ButtonLink to="/organiser/competitions/new" className="mt-7"><Plus size={17} aria-hidden="true" />Create your first competition</ButtonLink>
    </div>
  )
}
