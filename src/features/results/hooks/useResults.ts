import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getGuestResults, getOrganiserProgress } from '../api/results'

export function useGuestResults(roomId: string, roomPublished: boolean) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['guest', 'results', roomId],
    queryFn: () => getGuestResults(roomId),
    retry: false,
    refetchInterval: query => query.state.status !== 'error' && query.state.data?.phase === 'waiting' ? 5000 : false,
  })
  const phase = query.data?.phase
  useEffect(() => {
    if (!roomPublished && (phase === 'final' || phase === 'closed')) {
      void client.invalidateQueries({ queryKey: ['guest', 'room', roomId] })
    }
  }, [client, phase, roomId, roomPublished])
  return query
}

export function useOrganiserProgress(roomId: string, roomPublished: boolean) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['rooms', 'progress', roomId],
    queryFn: () => getOrganiserProgress(roomId),
    retry: false,
    refetchInterval: query => query.state.status !== 'error' && query.state.data?.phase === 'running' ? 2000 : false,
  })
  const phase = query.data?.phase
  useEffect(() => {
    if (!roomPublished && phase === 'final') {
      void client.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] })
      void client.invalidateQueries({ queryKey: ['rooms', 'list'] })
    }
  }, [client, phase, roomId, roomPublished])
  return query
}
