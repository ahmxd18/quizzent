import { ArrowLeft } from 'lucide-react'
import { PageContainer } from '../../components/layout/PageContainer'
import { ButtonLink } from '../../components/ui/Button'

export function NotFoundPage() {
  return (
    <PageContainer className="py-24 text-center">
      <p className="font-display text-7xl italic text-brand">404</p>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">A question mark of a page.</h1>
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">This page doesn't exist. Let's get you back to familiar ground.</p>
      <ButtonLink to="/" className="mt-8"><ArrowLeft size={17} aria-hidden="true" />Back to Quizzent</ButtonLink>
    </PageContainer>
  )
}
