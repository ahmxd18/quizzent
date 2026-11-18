import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../../lib/http'
import { sessionKey } from '../../auth/hooks/useSession'
import { cancelRoom, closeRoom, createInvitation, createRoom, getRoom, listRooms, renewInvitation } from '../api/rooms'
import { roomPollMs, roomRequestFailed } from './useRoomConnection'

function useOwnerSession(error: Error | null) {
  const client = useQueryClient()
  useEffect(() => { if (error instanceof ApiError && error.status === 401) client.setQueryData(sessionKey, null) }, [client, error])
}
export function useRooms() {
  const query = useQuery({ queryKey: ['rooms', 'list'], queryFn: listRooms, retry: false })
  useOwnerSession(query.error)
  return query
}
export function useRoom(id: string) {
  const query = useQuery({
    queryKey: ['rooms', 'detail', id], queryFn: () => getRoom(id), retry: false,
    refetchInterval: query => query.state.data?.room.status === 'open' ||
      (!query.state.data && roomRequestFailed(query.state.error)) ? roomPollMs : false,
  })
  useOwnerSession(query.error)
  return query
}
export function useCreateRoom() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createRoom, retry: false, onSuccess: () => client.invalidateQueries({ queryKey: ['rooms'] }),
    onError: error => { if (error instanceof ApiError && error.status === 401) client.setQueryData(sessionKey, null) } })
}
export function useRoomActions(id: string) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ['rooms'] })
  const onError = (error: Error) => { if (error instanceof ApiError && error.status === 401) client.setQueryData(sessionKey, null) }
  return {
    close: useMutation({ mutationFn: () => closeRoom(id), retry: false, onSuccess: refresh, onError }),
    cancel: useMutation({ mutationFn: (reason: string) => cancelRoom(id, reason), networkMode: 'always', retry: false, onSuccess: refresh, onError }),
    invite: useMutation({ mutationFn: (reference: string) => createInvitation(id, reference), retry: false, gcTime: 0, onSuccess: refresh, onError }),
    renew: useMutation({ mutationFn: (invitationId: string) => renewInvitation(id, invitationId), retry: false, gcTime: 0, onSuccess: refresh, onError }),
  }
}
