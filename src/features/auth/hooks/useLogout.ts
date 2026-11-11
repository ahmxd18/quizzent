import { useMutation, useQueryClient } from '@tanstack/react-query'
import { logout } from '../api/session'
import { sessionKey } from './useSession'

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: logout, retry: false,
    onSuccess: async () => {
      await client.cancelQueries()
      client.removeQueries({ predicate: query => query.queryKey[0] !== 'auth' })
      client.setQueryData(sessionKey, null)
    },
  })
}
