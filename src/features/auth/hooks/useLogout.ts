import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logout } from '../api/session'
import { sessionKey } from './useSession'
import { notify } from '../../../lib/notifications'
import { ApiError } from '../../../lib/http'

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: logout, retry: false,
    onSuccess: async () => {
      await client.cancelQueries()
      client.removeQueries({ predicate: query => query.queryKey[0] !== 'auth' })
      client.setQueryData(sessionKey, null)
      notify.info('You’ve been logged out.')
    },
    onError: error => notify.error(error instanceof ApiError ? error.message : 'Could not log out. Please try again.'),
  })
}
