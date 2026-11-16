import { Link, useParams } from 'react-router'
import { PageContainer } from '../../../components/layout/PageContainer'
import { RequestError } from '../../../components/ui/RequestError'
import { RoomDashboard } from '../components/RoomDashboard'
import { RoomFeedback } from '../components/RoomFeedback'
import { useRoom } from '../hooks/useRooms'

export function OrganiserRoomPage() {
  const { id = '' } = useParams()
  const query = useRoom(id)
  return <PageContainer className="py-10 sm:py-14"><div className="mx-auto max-w-5xl"><Link to="/organiser" className="mb-7 inline-block rounded-sm text-sm font-semibold text-muted hover:text-brand">← Organiser space</Link>
    {query.data ? <><RequestError error={query.error} /><RoomDashboard key={id} details={query.data} refreshing={query.isFetching} onRefresh={() => { void query.refetch() }} /></> : <RoomFeedback error={query.error} onRetry={() => { void query.refetch() }} />}
  </div></PageContainer>
}
