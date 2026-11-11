import { ArrowUpRight } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { PageContainer } from '../../components/layout/PageContainer'
import { ButtonLink } from '../../components/ui/Button'
import { useSession } from '../../features/auth/hooks/useSession'

const navigation = [
  { to: '/', label: 'Overview' },
  { to: '/join', label: 'Join a room' },
]

export function SiteHeader() {
  const { data: user } = useSession()
  const links = [...navigation, user ? { to: '/organiser', label: 'My space' } : { to: '/login', label: 'Log in' }]
  return (
    <header id="top" className="border-b border-outline">
      <PageContainer className="flex min-h-24 flex-wrap items-center justify-between gap-x-4 gap-y-4 py-5">
        <Link to="/" aria-label="Quizzent home" className="inline-flex items-center gap-3 rounded-lg">
          <span aria-hidden="true" className="relative grid size-9 place-items-center rounded-xl bg-brand font-display text-3xl italic text-on-brand">
            q<span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-canvas bg-accent" />
          </span>
          <span className="text-2xl font-bold tracking-tight">quizzent<span className="text-brand">.</span></span>
        </Link>
        <nav aria-label="Main navigation" className="order-3 flex w-full items-center justify-center gap-7 text-sm font-medium md:order-none md:w-auto">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `rounded-sm border-b-2 py-1 transition-colors ${isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:border-control hover:text-foreground'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <ButtonLink to={user ? '/organiser' : '/signup'} size="sm">Host a quiz <ArrowUpRight size={16} aria-hidden="true" /></ButtonLink>
      </PageContainer>
    </header>
  )
}
