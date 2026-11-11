import { useQuery } from '@tanstack/react-query'
import { getSession } from '../api/session'

export const sessionKey = ['auth', 'session'] as const

export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: getSession, retry: false, staleTime: 0, gcTime: 0 })
}
