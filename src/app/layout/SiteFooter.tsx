import { Link } from 'react-router'
import { PageContainer } from '../../components/layout/PageContainer'

export function SiteFooter() {
  return (
    <footer className="border-t border-outline">
      <PageContainer className="flex flex-wrap items-center justify-between gap-4 py-7 text-sm text-muted">
        <p><span className="font-semibold text-foreground">quizzent.</span> Made for curious minds.</p>
        <Link to="/signup" className="rounded-sm underline decoration-outline underline-offset-4 hover:decoration-brand hover:text-brand">Bring your own questions <span aria-hidden="true">↗</span></Link>
      </PageContainer>
    </footer>
  )
}
