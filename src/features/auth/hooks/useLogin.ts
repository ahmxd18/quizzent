import { useMutation, useQueryClient } from '@tanstack/react-query'
import { login } from '../api/session'
import { sessionKey } from './useSession'

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: login, retry: false, gcTime: 0,
    onSuccess: async ({ user }) => {
      // An older session request must not overwrite the successful login.
      await client.cancelQueries({ queryKey: sessionKey })
      client.setQueryData(sessionKey, user)
    },
  })
}
