import { ArrowUpRight, Clock3 } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '../../../components/ui/Badge'
import type { Competition } from '../api/competitions'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function CompetitionListItem({ competition }: { competition: Competition }) {
  return (
    <li>
      <Link to={`/organiser/competitions/${competition.id}/edit`} className="group flex flex-col gap-5 rounded-2xl p-6 transition-colors hover:bg-surface-strong motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="min-w-0 max-w-full break-words text-lg font-semibold tracking-tight group-hover:text-brand">{competition.title}</h3>
            <Badge tone={competition.status === 'published' ? 'accent' : 'neutral'}>{competition.status === 'published' ? 'Published' : 'Draft'}</Badge>
          </div>
          {competition.description && <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-muted">{competition.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-relaxed text-muted">
            <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />{competition.questionTimeSeconds} seconds per question</span>
            <span>Updated <time dateTime={competition.updatedAt}>{dateFormat.format(new Date(competition.updatedAt))}</time></span>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">{competition.status === 'published' ? 'View competition' : 'Edit draft'} <ArrowUpRight size={17} aria-hidden="true" /></span>
      </Link>
    </li>
  )
}
