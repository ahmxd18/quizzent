import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../../lib/http'
import { sessionKey } from '../../auth/hooks/useSession'
import { getAdminOverview, submitAdminAction, type AdminAction } from '../api/admin'

const overviewKey = ['admin', 'overview'] as const

function lostAccess(error: Error | null) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

export function useAdminOverview(userId: string, search: string) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: [...overviewKey, userId, search], queryFn: () => getAdminOverview(search), gcTime: 0, retry: false,
  })
  useEffect(() => {
    if (lostAccess(query.error)) void client.invalidateQueries({ queryKey: sessionKey })
  }, [client, query.error])
  return query
}

export function useAdminAction(takePassword: () => string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { action: AdminAction; reason: string; restricted: boolean; weeklyLimit: number | null }) =>
      submitAdminAction(input.action, { ...input, password: takePassword() }),
    retry: false,
    gcTime: 0,
    networkMode: 'always',
    onSuccess: () => client.invalidateQueries({ queryKey: overviewKey }),
    onError: error => {
      if (lostAccess(error)) void client.invalidateQueries({ queryKey: sessionKey })
      if (error instanceof ApiError && error.status === 409) void client.invalidateQueries({ queryKey: overviewKey })
    },
  })
}
