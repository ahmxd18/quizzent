import { PageContainer } from '../../../components/layout/PageContainer'
import { AccountPreview } from '../components/AccountPreview'

export function AccountPage({ mode }: { mode: 'login' | 'signup' }) {
  return <PageContainer className="py-12 sm:py-16"><div className="mx-auto max-w-lg"><AccountPreview mode={mode} /></div></PageContainer>
}
