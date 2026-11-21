import { Link } from 'react-router'
import { PageContainer } from '../../components/layout/PageContainer'
import { useSession } from '../../features/auth/hooks/useSession'

export function SiteFooter() {
  const { data: user, isPending } = useSession()
  return (
    <footer className="border-t border-outline">
      <PageContainer className="flex flex-wrap items-center justify-between gap-4 py-7 text-sm text-muted">
        <p><span className="font-semibold text-foreground">quizzent.</span> Made for curious minds.</p>
        {/* Replace this temporary destination when the portfolio is deployed. */}
        <a href="https://github.com/ahmxd18" target="_blank" rel="noopener noreferrer"
          className="rounded-sm underline decoration-outline underline-offset-4 hover:decoration-brand hover:text-brand">
          Meet the developer <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
        </a>
        {!isPending && <Link to={user ? '/organiser' : '/signup'} className="rounded-sm underline decoration-outline underline-offset-4 hover:decoration-brand hover:text-brand">Bring your own questions <span aria-hidden="true">↗</span></Link>}
      </PageContainer>
    </footer>
  )
}
