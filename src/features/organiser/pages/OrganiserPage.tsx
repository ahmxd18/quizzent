import { PageContainer } from '../../../components/layout/PageContainer'
import { useSession } from '../../auth/hooks/useSession'
import { OrganiserOverview } from '../components/OrganiserOverview'

export function OrganiserPage() {
  const { data: user } = useSession()
  return <PageContainer className="py-12 sm:py-16">{user && <OrganiserOverview user={user} />}</PageContainer>
}
