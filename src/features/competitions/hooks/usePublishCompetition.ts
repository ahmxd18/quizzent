import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../../lib/http'
import { sessionKey } from '../../auth/hooks/useSession'
import { publishCompetition } from '../api/competitions'
import { notify } from '../../../lib/notifications'

export function usePublishCompetition(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => publishCompetition(id), retry: false,
    onSuccess: async result => {
      await client.cancelQueries({ queryKey: ['competitions'] })
      client.setQueryData(['competitions', 'detail', id], result)
      await client.invalidateQueries({ queryKey: ['competitions'] })
      notify.success('Competition published.')
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 401) client.setQueryData(sessionKey, null)
      if (error instanceof ApiError && error.status === 409) {
        void client.invalidateQueries({ queryKey: ['competitions'] })
        void client.invalidateQueries({ queryKey: ['questions', id] })
      }
    },
  })
}
