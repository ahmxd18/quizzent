import { ArrowUpRight, LogOut } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { PageContainer } from '../../components/layout/PageContainer'
import { Button, ButtonLink } from '../../components/ui/Button'
import { useSession } from '../../features/auth/hooks/useSession'
import { useLogout } from '../../features/auth/hooks/useLogout'

const navigation = [
  { to: '/', label: 'Overview' },
  { to: '/join', label: 'Join a room' },
]

export function SiteHeader() {
  const { data: user, isPending } = useSession()
  const logout = useLogout()
  const links = [...navigation, user ? { to: '/organiser', label: 'My space' } : { to: '/login', label: 'Log in' }]
  if (user?.role === 'superadmin') {
    links.push({ to: '/admin', label: 'Admin controls' }, { to: '/admin/directory', label: 'Directory' })
  }
  return (
    <header id="top" className="border-b border-outline">
      <PageContainer className="flex min-h-24 flex-wrap items-center justify-between gap-x-4 gap-y-4 py-5">
        <Link to="/" aria-label="Quizzent home" className="inline-flex items-center gap-3 rounded-lg">
          <img src="/favicon.svg" alt="" className="size-10" />
          <span className="text-2xl font-bold tracking-tight">quizzent<span className="text-brand">.</span></span>
        </Link>
        <nav aria-label="Main navigation" className="order-3 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium xl:order-none xl:w-auto">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `rounded-sm border-b-2 py-1 transition-colors ${isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:border-control hover:text-foreground'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        {user ? <Button size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}>
          {logout.isPending ? 'Logging out…' : 'Log out'} <LogOut size={16} aria-hidden="true" />
        </Button> : !isPending && <ButtonLink to="/signup" size="sm">Host a quiz <ArrowUpRight size={16} aria-hidden="true" /></ButtonLink>}
      </PageContainer>
    </header>
  )
}
