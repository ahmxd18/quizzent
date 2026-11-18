import { useMutation, useQuery } from '@tanstack/react-query'
import { getGuestRoom, joinRoom, previewRoom, startGuestSession } from '../api/guest'
import { roomPollMs, roomRequestFailed } from './useRoomConnection'

export const useRoomPreview = (code: string) => useQuery({ queryKey: ['room-entry', code], queryFn: () => previewRoom(code), retry: false })
export const useGuestSession = (enabled: boolean) => useQuery({ queryKey: ['guest', 'session'], queryFn: startGuestSession, enabled, retry: false, staleTime: Infinity, gcTime: 0 })
export const useGuestRoom = (id: string) => useQuery({
  queryKey: ['guest', 'room', id], queryFn: () => getGuestRoom(id), retry: false,
  refetchInterval: query => query.state.data?.room.status === 'open' ||
    (!query.state.data && roomRequestFailed(query.state.error)) ? roomPollMs : false,
})
export const useJoinRoom = (code: string) => useMutation({ mutationFn: (input: { nickname: string; invitationToken?: string }) => joinRoom(code, input), retry: false, gcTime: 0 })
